const express = require('express');
const router = express.Router();
const Store = require('../models/Store');

// Get all stores
router.get('/', async (req, res) => {
  try {
    const stores = await Store.find().sort({ createdAt: -1 });
    res.json(stores);
  } catch (error) {
    console.error('Error fetching stores:', error);
    res.status(500).json({ message: 'Failed to fetch stores' });
  }
});

// Add new store
router.post('/', async (req, res) => {
  try {
    const { store_name, store_domain, access_token } = req.body;

    // Validate required fields
    if (!store_name || !store_domain || !access_token) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Clean up domain (remove protocol if present)
    const cleanDomain = store_domain.replace(/^https?:\/\//, '');

    // Check if store already exists
    const existingStore = await Store.findOne({ store_domain: cleanDomain });
    if (existingStore) {
      return res.status(400).json({ message: 'Store with this domain already exists' });
    }

    // Create new store
    const store = new Store({
      store_name,
      store_domain: cleanDomain,
      access_token,
      connected: false
    });

    await store.save();
    res.status(201).json(store);
  } catch (error) {
    console.error('Error adding store:', error);
    res.status(500).json({ message: 'Failed to add store' });
  }
});

// Test store connection
router.post('/:id/test', async (req, res) => {
  try {
    const store = await Store.findById(req.params.id);
    if (!store) {
      return res.status(404).json({ message: 'Store not found' });
    }

    // Test connection to Shopify API
    try {
      const fetch = require('node-fetch');
      const response = await fetch(`https://${store.store_domain}/admin/api/2023-10/shop.json`, {
        headers: {
          'X-Shopify-Access-Token': store.access_token,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        // Connection successful
        store.connected = true;
        await store.save();
        res.json({ success: true, message: 'Connection successful' });
      } else {
        // Connection failed
        store.connected = false;
        await store.save();
        res.status(400).json({ success: false, message: 'Connection failed: Invalid credentials' });
      }
    } catch (error) {
      console.error('Connection test error:', error);
      store.connected = false;
      await store.save();
      res.status(400).json({ success: false, message: 'Connection failed: Network error' });
    }
  } catch (error) {
    console.error('Error testing store connection:', error);
    res.status(500).json({ message: 'Failed to test connection' });
  }
});

// Update store
router.put('/:id', async (req, res) => {
  try {
    const { store_name, store_domain, access_token } = req.body;

    const store = await Store.findById(req.params.id);
    if (!store) {
      return res.status(404).json({ message: 'Store not found' });
    }

    // Update fields if provided
    if (store_name) store.store_name = store_name;
    if (store_domain) store.store_domain = store_domain.replace(/^https?:\/\//, '');
    if (access_token) {
      store.access_token = access_token;
      store.connected = false; // Reset connection status when token changes
    }

    await store.save();
    res.json(store);
  } catch (error) {
    console.error('Error updating store:', error);
    res.status(500).json({ message: 'Failed to update store' });
  }
});

// Delete store
router.delete('/:id', async (req, res) => {
  try {
    const store = await Store.findByIdAndDelete(req.params.id);
    if (!store) {
      return res.status(404).json({ message: 'Store not found' });
    }

    res.json({ message: 'Store deleted successfully' });
  } catch (error) {
    console.error('Error deleting store:', error);
    res.status(500).json({ message: 'Failed to delete store' });
  }
});

module.exports = router;

