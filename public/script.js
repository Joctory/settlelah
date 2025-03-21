let dishes = [];
let members = [];
let currentStep = 1;
let groups = JSON.parse(localStorage.getItem("groups")) || {};
let currentGroup = "";
let editMode = false;
let editingIndex = -1;

function showError(message) {
  document.getElementById("error").textContent = message;
}

function clearError() {
  document.getElementById("error").textContent = "";
}

function nextStep(step, action) {
  if (step === 1) {
    const groupSelect = document.getElementById("groupSelect").value;
    if (!groupSelect && action !== "new") {
      showError('Please select a group or click "New Split Group".');
      return;
    }
    if (action === "select") {
      currentGroup = groupSelect;
      members = groups[groupSelect];
      loadMembersForDrag();
      currentStep = 2; // Skip to Step 3 (Add Dishes)
      document.getElementById("step1").style.display = "none";
      document.getElementById("step3").style.display = "block";
      updateGroupActions();
      dishes = [];
      updateDishList();
      document.getElementById("dishMembers").innerHTML = "";
      document.getElementById("next3").disabled = true;
      closeSummary();
      return;
    } else {
      members = [];
      currentGroup = "";
    }
  } else if (step === 2) {
    if (members.length === 0) {
      showError("Please add at least one member.");
      return;
    }
    loadMembersForDrag();
  }

  clearError();
  document.getElementById(`step${step}`).style.display = "none";
  currentStep = step + 1;
  document.getElementById(`step${currentStep}`).style.display = "block";
  updateGroupActions();
}

function backStep(step) {
  if (step > 1 && (dishes.length > 0 || members.length > 0)) {
    document.getElementById("backConfirmModal").style.display = "block";
    return;
  }
  resetToHome(step);
}

function confirmBack() {
  resetToHome(currentStep);
  closeBackConfirm();
}

function closeBackConfirm() {
  document.getElementById("backConfirmModal").style.display = "none";
}

function showStep(step) {
  document.querySelectorAll(".step").forEach((s) => (s.style.display = "none"));
  document.getElementById(`step${step}`).style.display = "block";
  currentStep = step;
  clearError();
}

function showHistory() {
  document.querySelectorAll(".step").forEach((s) => (s.style.display = "none"));
  document.getElementById("history").style.display = "block";
  fetchHistory();
}

function clearHistory() {
  localStorage.removeItem("billHistory");
  Object.keys(localStorage)
    .filter((key) => key.startsWith("bill:"))
    .forEach((key) => localStorage.removeItem(key));
  fetchHistory();
}

function fetchHistory() {
  const billIds = JSON.parse(localStorage.getItem("billHistory") || "[]");
  const historyList = document.getElementById("historyList");
  historyList.innerHTML = "Loading...";

  Promise.all(
    billIds.map((id) =>
      fetch(`/result/${id}`)
        .then((res) => res.text())
        .then((html) => {
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, "text/html");
          const total = doc.querySelector("h2").textContent.replace("Total: $", "");
          const timestamp = JSON.parse(localStorage.getItem(`bill:${id}`) || "{}").timestamp || "Unknown";
          return { id, total, timestamp };
        })
        .catch(() => null)
    )
  )
    .then((bills) => {
      historyList.innerHTML = "";
      bills
        .filter((bill) => bill)
        .forEach((bill) => {
          const li = document.createElement("li");
          li.innerHTML = `
        <a href="/result/${bill.id}" target="_blank">
          ${new Date(bill.timestamp).toLocaleString()} - Total: $${bill.total}
        </a>
      `;
          historyList.appendChild(li);
        });
      if (bills.length === 0) historyList.textContent = "No history yet.";
    })
    .catch((err) => showError("Error loading history. Please try again."));
}

function resetToHome(step) {
  dishes = [];
  members = [];
  currentGroup = "";
  updateDishList();
  closeSummary();
  document.getElementById("dishMembers").innerHTML = "";
  document.getElementById("next3").disabled = true;
  showStep(1);
  document.getElementById("groupSelect").value = "";
  document.getElementById("next1").disabled = true;
  clearError();
}

function loadMembersForDrag() {
  const memberPool = document.getElementById("memberPool");
  memberPool.innerHTML = "";
  members.forEach((member, index) => {
    const li = document.createElement("li");
    li.textContent = member;
    li.dataset.member = member;
    li.ondblclick = () => editMember(index);
    memberPool.appendChild(li);
  });

  Sortable.create(memberPool, {
    group: { name: "members", pull: "clone", put: false },
    sort: false,
    animation: 150,
  });

  const dishMembers = document.getElementById("dishMembers");
  Sortable.create(dishMembers, {
    group: "members",
    animation: 150,
    onAdd: function (evt) {
      const item = evt.item;
      const memberName = item.dataset.member;
      const existingMembers = Array.from(dishMembers.children)
        .filter((li) => li !== item) // Exclude the newly added item from the check
        .map((li) => li.dataset.member);
      if (existingMembers.includes(memberName)) {
        item.remove(); // Remove if already exists
        return;
      }
      item.ondblclick = () => item.remove(); // Double-click to remove
    },
  });
}

function addDish() {
  const dishName = document.getElementById("dishName").value.trim();
  const dishCost = document.getElementById("dishCost").value;
  const assignedMembers = Array.from(document.getElementById("dishMembers").children).map((li) => li.dataset.member);

  if (!dishName) {
    showError("Please enter a dish name.");
    return;
  }
  if (!dishCost || isNaN(dishCost) || parseFloat(dishCost) <= 0) {
    showError("Please enter a valid dish cost greater than 0.");
    return;
  }
  if (assignedMembers.length === 0) {
    showError("Please drag at least one member to assign the dish.");
    return;
  }

  clearError();
  dishes.push({ name: dishName, cost: parseFloat(dishCost), members: assignedMembers });
  updateDishList();
  clearDishInputs();
  showSummary();
  document.getElementById("next3").disabled = false;
}

function editDish(index) {
  const dish = dishes[index];
  document.getElementById("dishName").value = dish.name;
  document.getElementById("dishCost").value = dish.cost;
  const assigned = document.getElementById("dishMembers");
  assigned.innerHTML = "";
  dish.members.forEach((member) => {
    const li = document.createElement("li");
    li.textContent = member;
    li.dataset.member = member;
    li.ondblclick = () => li.remove();
    assigned.appendChild(li);
  });
  dishes.splice(index, 1);
  updateDishList();
  clearError();
  showSummary();
}

function deleteDish(index) {
  dishes.splice(index, 1);
  updateDishList();
  clearError();
  if (dishes.length === 0) {
    document.getElementById("next3").disabled = true;
    closeSummary();
  } else {
    showSummary();
  }
}

function updateDishList() {
  const dishList = document.getElementById("dishList");
  dishList.innerHTML = "";
  dishes.forEach((dish, index) => {
    const li = document.createElement("li");
    li.innerHTML = `${dish.name}: $${dish.cost.toFixed(2)} (split: ${dish.members.join(", ")}) 
      <button onclick="editDish(${index})">Edit</button>
      <button onclick="deleteDish(${index})">Delete</button>`;
    dishList.appendChild(li);
  });

  const total = dishes.reduce((sum, dish) => sum + dish.cost, 0);
  document.getElementById("summaryTotal").textContent = `Total Dishes Cost: $${total.toFixed(2)}`;
}

function clearDishInputs() {
  document.getElementById("dishName").value = "";
  document.getElementById("dishCost").value = "";
  document.getElementById("dishMembers").innerHTML = "";
}

function showSummary() {
  const panel = document.getElementById("summaryPanel");
  panel.style.right = "0";
}

function closeSummary() {
  const panel = document.getElementById("summaryPanel");
  panel.style.right = "-400px";
}

function showSettings() {
  const popup = document.getElementById("settingsPopup");
  popup.style.display = "block";
}

function closeSettings() {
  const popup = document.getElementById("settingsPopup");
  popup.style.display = "none";
}

function saveSettings() {
  const profile = document.getElementById("taxProfile").value;
  document.getElementById("serviceRate").textContent = "10%";
  document.getElementById("gstRate").textContent = profile === "singapore" ? "9%" : "6%";
  closeSettings();
}

function addMemberPopup(mode = "new") {
  editMode = mode === "edit";
  document.getElementById("newMemberName").value = "";
  document.getElementById("addMemberPopup").style.display = "block";
}

function closeAddMember() {
  document.getElementById("addMemberPopup").style.display = "none";
}

function saveNewMember() {
  const name = document.getElementById("newMemberName").value.trim();
  if (!name) {
    showError("Please enter a member name.");
    return;
  }
  if (members.includes(name)) {
    showError("This name is already added.");
    return;
  }
  members.push(name);
  if (editMode) {
    updateEditGroupList();
  } else {
    updateMemberList();
  }
  closeAddMember();
  clearError();
  document.getElementById("next2").disabled = false;
}

function updateMemberList() {
  const list = document.getElementById("memberList");
  list.innerHTML = "";
  members.forEach((member, index) => {
    const li = document.createElement("li");
    li.textContent = member;
    const editBtn = document.createElement("button");
    editBtn.textContent = "Edit";
    editBtn.onclick = () => editMember(index);
    const removeBtn = document.createElement("button");
    removeBtn.textContent = "Remove";
    removeBtn.onclick = () => removeMember(index);
    li.appendChild(editBtn);
    li.appendChild(removeBtn);
    list.appendChild(li);
  });
}

function removeMember(index) {
  members.splice(index, 1);
  if (editMode) {
    updateEditGroupList();
  } else {
    updateMemberList();
  }
  if (members.length === 0) document.getElementById("next2").disabled = true;
}

function editMember(index) {
  editingIndex = index;
  document.getElementById("editMemberName").value = members[index];
  document.getElementById("editMemberPopup").style.display = "block";
}

function closeEditMember() {
  document.getElementById("editMemberPopup").style.display = "none";
  editingIndex = -1;
}

function saveEditedMember() {
  const newName = document.getElementById("editMemberName").value.trim();
  if (!newName) {
    showError("Please enter a member name.");
    return;
  }
  if (members.includes(newName) && newName !== members[editingIndex]) {
    showError("This name is already added.");
    return;
  }
  members[editingIndex] = newName;
  if (editMode) {
    updateEditGroupList();
  } else {
    updateMemberList();
  }
  loadMembersForDrag();
  closeEditMember();
  clearError();
}

function editGroupMembers() {
  if (!currentGroup) return;
  updateEditGroupList();
  document.getElementById("editGroupPopup").style.display = "block";
}

function closeEditGroup() {
  document.getElementById("editGroupPopup").style.display = "none";
}

function updateEditGroupList() {
  const list = document.getElementById("editGroupList");
  list.innerHTML = "";
  members.forEach((member, index) => {
    const li = document.createElement("li");
    li.textContent = member;
    const editBtn = document.createElement("button");
    editBtn.textContent = "Edit";
    editBtn.onclick = () => editMember(index);
    const removeBtn = document.createElement("button");
    removeBtn.textContent = "Remove";
    removeBtn.onclick = () => removeMember(index);
    li.appendChild(editBtn);
    li.appendChild(removeBtn);
    list.appendChild(li);
  });
}

function saveEditedGroup() {
  if (members.length === 0) {
    showError("Please add at least one member.");
    return;
  }
  dishes = [];
  updateDishList();
  closeSummary();
  document.getElementById("dishMembers").innerHTML = "";
  document.getElementById("next3").disabled = true;
  groups[currentGroup] = [...members];
  localStorage.setItem("groups", JSON.stringify(groups));
  loadMembersForDrag();
  closeEditGroup();
  showError("Group members updated. All dishes have been cleared.");
}

function saveAsGroup() {
  document.getElementById("groupName").value = "";
  document.getElementById("groupMembersPreview").textContent = members.join(", ");
  document.getElementById("saveGroupPopup").style.display = "block";
}

function closeSaveGroup() {
  document.getElementById("saveGroupPopup").style.display = "none";
}

function confirmSaveGroup() {
  const groupName = document.getElementById("groupName").value.trim();
  if (!groupName) {
    showError("Please enter a group name.");
    return;
  }
  if (groups[groupName]) {
    showError("Group name already exists. Choose a different name.");
    return;
  }
  groups[groupName] = [...members];
  currentGroup = groupName;
  localStorage.setItem("groups", JSON.stringify(groups));
  updateGroupSelect();
  document.getElementById("editGroupBtn").style.display = "inline";
  document.getElementById("saveGroupBtn").style.display = "none";
  closeSaveGroup();
  clearError();
}

function updateGroupSelect() {
  const select = document.getElementById("groupSelect");
  select.innerHTML = '<option value="">-- Select a Group --</option>';
  Object.keys(groups).forEach((group) => {
    const option = document.createElement("option");
    option.value = group;
    option.textContent = group;
    select.appendChild(option);
  });
  select.onchange = () => {
    document.getElementById("next1").disabled = !select.value;
  };
}

function updateGroupActions() {
  document.getElementById("editGroupBtn").style.display = currentGroup ? "inline" : "none";
  document.getElementById("saveGroupBtn").style.display = currentGroup ? "none" : "inline";
}

function calculateBill() {
  if (dishes.length === 0) {
    showError("Please add at least one dish before calculating.");
    return;
  }

  clearError();
  const taxProfile = document.getElementById("taxProfile").value;
  const discount = document.getElementById("discount").value || "0";
  const applyServiceCharge = document.getElementById("serviceCharge").checked;
  const applyGst = document.getElementById("gst").checked;
  const billData = { members, dishes, discount, applyServiceCharge, applyGst, taxProfile };

  fetch("/calculate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(billData),
  })
    .then((response) => response.json())
    .then((result) => {
      // Store bill ID in localStorage
      const billIds = JSON.parse(localStorage.getItem("billHistory") || "[]");
      if (!billIds.includes(result.id)) {
        billIds.push(result.id);
        localStorage.setItem("billHistory", JSON.stringify(billIds));
        localStorage.setItem(`bill:${result.id}`, JSON.stringify({ timestamp: new Date().toISOString() }));
      }
      document.getElementById("result").innerHTML = `
        <p>Share this link: <a href="${result.link}" target="_blank">${result.link}</a></p>
        <p>(Opens in a new tab)</p>
      `;
    })
    .catch((err) => showError("Error calculating bill. Please try again."));
}

// Initialize
document.getElementById("taxProfile").value = "singapore";
document.getElementById("serviceRate").textContent = "10%";
document.getElementById("gstRate").textContent = "9%";
updateGroupSelect();
