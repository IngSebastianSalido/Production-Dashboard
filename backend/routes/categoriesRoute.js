const express = require('express');
const fs = require('fs');

module.exports = (categoriesFilePath) => {
  const router = express.Router();

  let categories = [];
  if (fs.existsSync(categoriesFilePath)) {
    const data = fs.readFileSync(categoriesFilePath, 'utf8');
    try {
      categories = JSON.parse(data).categories || [];
    } catch (e) {
      console.error('Error parsing categories file:', e);
    }
  }

  router.get('/categories', (req, res) => {
    res.json(categories);
  });

  return router;
};
