// Cache for fetched page content
window.pageContentCache = {};

// Fetch and cache page content
async function getPageContent(path) {
  if (window.pageContentCache[path]) {
    return window.pageContentCache[path];
  }
  
  try {
    const response = await fetch(path);
    const html = await response.text();
    // Strip HTML tags and get text content
    const content = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    window.pageContentCache[path] = content;
    return content;
  } catch (e) {
    console.error('Error fetching page:', path, e);
    return '';
  }
}

// Improved fuzzy search with content search
async function performSearch(query) {
  if (!query || query.trim().length === 0) return [];
  
  const trimmedQuery = query.trim().toLowerCase();
  const queryWords = trimmedQuery.split(/\s+/).filter(w => w.length > 0);
  const results = [];
  
  for (const entry of window.siteSearchIndex) {
    const pathLower = entry.path.toLowerCase();
    const titleLower = entry.title.toLowerCase();
    let snippetLower = entry.snippet.toLowerCase();
    let score = 0;
    let matchCount = 0;
    
    // Try to get full page content for better matching
    const fullContent = await getPageContent(entry.path);
    const fullContentLower = fullContent.toLowerCase();
    
    // Check each word in the query
    for (const word of queryWords) {
      if (word.length < 2) continue;
      
      // Exact match in title (strongest signal)
      if (titleLower.includes(word)) {
        score += 100;
        matchCount++;
      }
      // Exact match in path
      else if (pathLower.includes(word)) {
        score += 50;
        matchCount++;
      }
      // Exact match in full page content
      else if (fullContentLower.includes(word)) {
        score += 30;
        matchCount++;
      }
      // Exact match in snippet
      else if (snippetLower.includes(word)) {
        score += 15;
        matchCount++;
      }
      // Fuzzy match in title
      else if (window.levenshteinSimilarity(word, titleLower) > 0.7) {
        score += 40;
        matchCount++;
      }
      // Fuzzy match in path
      else if (window.levenshteinSimilarity(word, pathLower) > 0.7) {
        score += 20;
        matchCount++;
      }
      // Fuzzy match in full content
      else if (window.levenshteinSimilarity(word, fullContentLower) > 0.7) {
        score += 25;
        matchCount++;
      }
    }
    
    // Only include results where at least one word matched
    if (matchCount > 0) {
      score = score * (1 + (matchCount - 1) * 0.2);
      results.push({ ...entry, score });
    }
  }
  
  // Sort by score descending
  results.sort((a, b) => b.score - a.score);
  
  // Return top 12 results
  return results.slice(0, 12);
}

// Calculate similarity between two strings using Levenshtein distance
window.levenshteinSimilarity = function(s1, s2) {
  const shorter = s1.length <= s2.length ? s1 : s2;
  const longer = s1.length <= s2.length ? s2 : s1;
  
  if (longer.length === 0) return 1.0;
  
  // Check if shorter is substring of longer
  if (longer.includes(shorter)) return 0.95;
  
  // Levenshtein distance
  const distances = [];
  for (let i = 0; i <= shorter.length; i++) {
    distances[i] = [i];
  }
  for (let j = 0; j <= longer.length; j++) {
    distances[0][j] = j;
  }
  
  for (let i = 1; i <= shorter.length; i++) {
    for (let j = 1; j <= longer.length; j++) {
      const cost = shorter[i - 1] === longer[j - 1] ? 0 : 1;
      distances[i][j] = Math.min(
        distances[i - 1][j] + 1,
        distances[i][j - 1] + 1,
        distances[i - 1][j - 1] + cost
      );
    }
  }
  
  const maxLen = longer.length;
  const distance = distances[shorter.length][longer.length];
  return 1 - (distance / maxLen);
}

// Initialize search functionality when DOM is ready
function initializeSearch() {
  const searchInput = document.getElementById('search-input');
  const searchResults = document.getElementById('search-results');
  
  if (!searchInput || !searchResults) return;
  
  let searchTimeout;
  
  // Handle input with debouncing
  searchInput.addEventListener('input', function() {
    const query = this.value;
    
    clearTimeout(searchTimeout);
    
    if (query.length === 0) {
      searchResults.innerHTML = '';
      searchResults.style.display = 'none';
      return;
    }
    
    // Show loading state
    searchResults.innerHTML = '<div class="search-result-item">Searching...</div>';
    searchResults.style.display = 'block';
    
    // Debounce search to avoid too many requests
    searchTimeout = setTimeout(async () => {
      try {
        const results = await performSearch(query);
        
        if (results.length === 0) {
          searchResults.innerHTML = '<div class="search-result-item">No results found</div>';
          searchResults.style.display = 'block';
          return;
        }
        
        let html = '';
        for (const result of results) {
          html += `
            <a href="${result.path}" class="search-result-item">
              <div class="result-title">${result.title}</div>
              <div class="result-path">${result.path}</div>
              <div class="result-snippet">${result.snippet.substring(0, 150)}...</div>
            </a>
          `;
        }
        
        searchResults.innerHTML = html;
        searchResults.style.display = 'block';
      } catch (e) {
        console.error('Search error:', e);
        searchResults.innerHTML = '<div class="search-result-item">Search error</div>';
      }
    }, 400); // Wait 400ms after user stops typing
  });
  
  // Close results when clicking outside
  document.addEventListener('click', function(e) {
    if (!e.target.closest('.search-bar') && !e.target.closest('#search-results')) {
      searchResults.style.display = 'none';
    }
  });
  
  // Allow clicking on search bar to show results again
  searchInput.addEventListener('focus', function() {
    if (this.value.length > 0 && searchResults.innerHTML) {
      searchResults.style.display = 'block';
    }
  });
}

// Run when DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeSearch);
} else {
  initializeSearch();
}
