/**
 * Firestore Adapter for SettleLah
 * Provides a consistent interface for Firestore operations with error handling and authentication
 */

// No client SDK imports needed - using admin.firestore() directly

// FirestoreAdapter class to handle Firestore operations
class FirestoreAdapter {
  constructor(db) {
    this.db = db;
  }

  /**
   * Save a bill to Firestore with error handling
   * @param {string} id - Bill ID
   * @param {Object} data - Bill data
   * @returns {Promise<void>}
   */
  async saveBill(id, data) {
    try {
      // Using Admin SDK - no auth token needed
      await this.db.collection('bills').doc(id).set(data);
      // Bill saved successfully (silent mode)
    } catch (error) {
      // Detailed error logging
      console.error(`Error saving bill ${id}:`, error);

      // Special handling for permission errors
      if (error.code === 'permission-denied') {
        console.warn('Permission denied. Check your security rules and authentication.');

        // Development fallback: Retry with relaxed validation
        if (process.env.SETTLELAH_DEV_MODE === 'true') {
          console.warn('Attempting fallback save with minimal data in dev mode');

          // Create minimal valid data that should pass security rules
          const minimalData = {
            members: data.members || [],
            dishes: data.dishes || [],
            timestamp: Date.now(),
            breakdown: data.breakdown || { total: 0 },
            perPersonBreakdown: data.perPersonBreakdown || {},
            totals: data.totals || {}
          };

          try {
            await this.db.collection('bills').doc(id).set(minimalData);
            // Bill saved with fallback method (silent mode)
          } catch (fallbackError) {
            console.error('Fallback save also failed:', fallbackError);
            throw fallbackError;
          }
        } else {
          throw error;
        }
      } else {
        throw error;
      }
    }
  }

  /**
   * Get a bill from Firestore with error handling
   * @param {string} id - Bill ID
   * @returns {Promise<Object|null>} Bill data or null if not found
   */
  async getBill(id) {
    try {
      const billDoc = await this.db.collection('bills').doc(id).get();
      return billDoc.exists ? billDoc.data() : null;
    } catch (error) {
      console.error(`Error getting bill ${id}:`, error);

      // In development mode, return dummy data for testing
      if (process.env.SETTLELAH_DEV_MODE === 'true' && error.code === 'permission-denied') {
        console.warn('Returning mock data in development mode');
        return {
          members: [{ name: 'Test User', avatar: 1 }],
          dishes: [{ name: 'Test Dish', cost: 10, members: ['Test User'] }],
          timestamp: Date.now(),
          breakdown: { subtotal: 10, total: 10 },
          perPersonBreakdown: { 'Test User': { total: 10 } },
          totals: { 'Test User': 10 }
        };
      }

      throw error;
    }
  }

  /**
   * Delete bills from Firestore with error handling
   * @param {Array<string>} ids - Array of bill IDs to delete
   * @returns {Promise<void>}
   */
  async deleteBills(ids) {
    try {
      // Filter valid IDs
      const validIds = ids.filter((id) => {
        const newPattern = /^[a-z0-9]+-[a-z0-9]+-[a-z0-9]+$/i;
        const legacyPattern = /^[a-z0-9]{6}$/i;
        return newPattern.test(id) || legacyPattern.test(id);
      });

      if (validIds.length === 0) {
        console.warn('No valid IDs to delete');
        return;
      }

      const batch = this.db.batch();

      validIds.forEach((id) => {
        const billRef = this.db.collection('bills').doc(id);
        batch.delete(billRef);
      });

      await batch.commit();
      // Deleted bills successfully (silent mode)
    } catch (error) {
      console.error('Error deleting bills:', error);

      // In development mode, handle permission errors gracefully
      if (process.env.SETTLELAH_DEV_MODE === 'true' && error.code === 'permission-denied') {
        console.warn('Simulating successful deletion in development mode');
        return;
      }

      throw error;
    }
  }
}

module.exports = FirestoreAdapter;
