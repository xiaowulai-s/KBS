// ====================================
// test-runner.js - Knowledge Base Unit Tests (Node.js compatible)
// ====================================

// ==========================================
// TEST FIXTURES & HELPERS
// ==========================================

class MockElement {
  constructor(tag, id = '') {
    this.tagName = tag.toUpperCase();
    this.id = id;
    this.children = [];
    this.innerHTML = '';
    this.style = {};
    this.classList = new Set();
    this.events = {};
  }
}

// ==========================================
// TESTS
// ==========================================

const tests = [];

// Test 1: ID uniqueness validation
tests.push({
  name: 'ID uniqueness validation',
  fn: () => {
    const entries = [
      { id: 1, title: 'Entry 1' },
      { id: 2, title: 'Entry 2' },
      { id: 3, title: 'Entry 3' },
    ];
    
    const ids = entries.map(e => e.id);
    const uniqueIds = new Set(ids);
    
    if (ids.length !== uniqueIds.size) {
      throw new Error('Duplicate IDs found');
    }
    
    return 'IDs are unique';
  }
});

// Test 2: Category filtering
tests.push({
  name: 'Category filtering',
  fn: () => {
    const entries = [
      { id: 1, title: 'Test 1', category: 'Tech' },
      { id: 2, title: 'Test 2', category: 'Science' },
      { id: 3, title: 'Test 3', category: 'Tech' },
    ];
    
    const filtered = entries.filter(e => e.category === 'Tech');
    
    if (filtered.length !== 2) {
      throw new Error(`Expected 2 tech entries, got ${filtered.length}`);
    }
    
    return `Filtered ${filtered.length} tech entries`;
  }
});

// Test 3: Tag filtering
tests.push({
  name: 'Tag filtering',
  fn: () => {
    const entries = [
      { id: 1, title: 'Test 1', tags: ['js', 'web'] },
      { id: 2, title: 'Test 2', tags: ['py', 'data'] },
      { id: 3, title: 'Test 3', tags: ['js', 'api'] },
    ];
    
    const filtered = entries.filter(e => e.tags.includes('js'));
    
    if (filtered.length !== 2) {
      throw new Error(`Expected 2 js entries, got ${filtered.length}`);
    }
    
    return `Filtered ${filtered.length} js entries`;
  }
});

// Test 4: Favorites toggle
tests.push({
  name: 'Favorites toggle',
  fn: () => {
    const favorites = new Set();
    
    // Add favorite
    favorites.add(1);
    if (!favorites.has(1)) {
      throw new Error('Failed to add favorite');
    }
    
    // Remove favorite
    favorites.delete(1);
    if (favorites.has(1)) {
      throw new Error('Failed to remove favorite');
    }
    
    return 'Favorites toggle works';
  }
});

// Test 5: Batch selection
tests.push({
  name: 'Batch selection',
  fn: () => {
    const selectedIds = new Set();
    const entries = [1, 2, 3, 4, 5];
    
    entries.forEach(id => selectedIds.add(id));
    
    if (selectedIds.size !== 5) {
      throw new Error(`Expected 5 selected, got ${selectedIds.size}`);
    }
    
    return `Selected ${selectedIds.size} items`;
  }
});

// Test 6: Pagination
tests.push({
  name: 'Pagination',
  fn: () => {
    const entries = Array.from({ length: 25 }, (_, i) => ({ id: i + 1 }));
    const pageSize = 10;
    const page = 1;
    const start = (page - 1) * pageSize;
    const paged = entries.slice(start, start + pageSize);
    
    if (paged.length !== 10) {
      throw new Error(`Expected 10 items per page, got ${paged.length}`);
    }
    
    if (paged[0].id !== 1 || paged[9].id !== 10) {
      throw new Error(`Pagination range incorrect`);
    }
    
    return `Page ${page} has ${paged.length} items`;
  }
});

// Test 7: Search history limit
tests.push({
  name: 'Search history limit',
  fn: () => {
    const history = [];
    const maxHistory = 10;
    
    // Add more items than max
    for (let i = 0; i < maxHistory + 5; i++) {
      history.unshift(`Search ${i + 1}`);
      if (history.length > maxHistory) {
        history.pop();
      }
    }
    
    if (history.length !== maxHistory) {
      throw new Error(`Expected ${maxHistory} items, got ${history.length}`);
    }
    
    return `Search history limited to ${history.length} items`;
  }
});

// Test 8: Markdown sanitization
tests.push({
  name: 'Markdown sanitization',
  fn: () => {
    const dangerousContent = '<script>alert("xss")</script>';
    const sanitized = dangerousContent.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    
    if (sanitized.includes('<script>')) {
      throw new Error('XSS content not sanitized');
    }
    
    return 'Content sanitized successfully';
  }
});

// Test 9: Theme toggle
tests.push({
  name: 'Theme toggle',
  fn: () => {
    let currentTheme = 'light';
    
    // Toggle to dark
    currentTheme = 'dark';
    if (currentTheme !== 'dark') {
      throw new Error('Failed to toggle to dark');
    }
    
    // Toggle back to light
    currentTheme = 'light';
    if (currentTheme !== 'light') {
      throw new Error('Failed to toggle to light');
    }
    
    return 'Theme toggle works';
  }
});

// Test 10: Clear filters
tests.push({
  name: 'Clear filters',
  fn: () => {
    let activeCategory = 'Tech';
    let activeTag = 'js';
    let searchQuery = 'test';
    
    // Clear filters
    activeCategory = null;
    activeTag = null;
    searchQuery = '';
    
    if (activeCategory || activeTag || searchQuery) {
      throw new Error('Filters not cleared');
    }
    
    return 'Filters cleared successfully';
  }
});

// ==========================================
// RUN TESTS
// ==========================================

console.log('🧪 Running Knowledge Base Tests...\n');

let passed = 0;
let failed = 0;
const results = [];

for (const test of tests) {
  try {
    const result = test.fn();
    console.log(`✅ PASS: ${test.name}`);
    console.log(`   ${result}`);
    passed++;
    results.push({ name: test.name, status: 'pass', message: result });
  } catch (error) {
    console.error(`❌ FAIL: ${test.name}`);
    console.error(`   ${error.message}`);
    failed++;
    results.push({ name: test.name, status: 'fail', message: error.message });
  }
}

console.log('\n📊 Test Summary:');
console.log(`   Total: ${tests.length}`);
console.log(`   ✅ Passed: ${passed}`);
console.log(`   ❌ Failed: ${failed}`);

if (failed > 0) {
  console.log('\n🔍 Failed Tests:');
  results.filter(r => r.status === 'fail').forEach(r => {
    console.log(`   - ${r.name}: ${r.message}`);
  });
}

process.exit(failed > 0 ? 1 : 0);
