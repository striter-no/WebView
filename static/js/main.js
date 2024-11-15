document.addEventListener('DOMContentLoaded', function() {
    const treeView = document.getElementById('tree-view');
    const searchResults = document.getElementById('search-results');
    const docContent = document.getElementById('doc-content');
    const searchInput = document.getElementById('search');
    const marker = new Mark(docContent);

    async function loadTree() {
        const response = await fetch('/api/tree');
        const tree = await response.json();
        renderTree(sortTreeItems(tree), treeView);
    }

    // Сортировка элементов (папки перед файлами)
    function sortTreeItems(items) {
        return items.sort((a, b) => {
            if (a.type === b.type) {
                return a.name.localeCompare(b.name);
            }
            return a.type === 'directory' ? -1 : 1;
        }).map(item => {
            if (item.children) {
                item.children = sortTreeItems(item.children);
            }
            return item;
        });
    }

    
    function renderTree(items, container) {
        items.forEach(item => {
            const treeItem = document.createElement('div');
            treeItem.className = 'tree-item';
            treeItem.setAttribute('data-type', item.type);
            
            const treeContent = document.createElement('div');
            treeContent.className = 'tree-content';
            
            const arrow = document.createElement('div');
            arrow.className = 'tree-arrow';
            
            const icon = document.createElement('span');
            icon.className = `tree-icon ${item.type === 'file' ? 'file-icon' : ''}`;
            icon.innerHTML = item.type === 'directory' ? '📁' : '📄';
            
            const name = document.createElement('span');
            name.textContent = item.name;
            
            treeContent.appendChild(arrow);
            treeContent.appendChild(icon);
            treeContent.appendChild(name);
            treeItem.appendChild(treeContent);
            
            if (item.type === 'directory' && item.children?.length > 0) {
                const childrenContainer = document.createElement('div');
                childrenContainer.className = 'tree-children';
                renderTree(item.children, childrenContainer);
                
                treeContent.addEventListener('click', (e) => {
                    e.stopPropagation();
                    treeItem.classList.toggle('expanded');
                });
                
                treeItem.appendChild(childrenContainer);
            } else if (item.type === 'file') {
                treeContent.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    loadContent(item.path);
                });
            }
            
            container.appendChild(treeItem);
        });
    }
    
    async function loadContent(path, searchQuery = '') {
        const response = await fetch(`/api/content/${path}`);
        const data = await response.json();
        if (data.content) {
            docContent.innerHTML = data.content;
            // Инициализируем подсветку синтаксиса
            document.querySelectorAll('pre code').forEach((block) => {
                hljs.highlightBlock(block);
            });
            // Подсвечиваем искомый текст, если есть
            if (searchQuery) {
                marker.unmark();
                marker.mark(searchQuery, {
                    accuracy: "partially",
                    separateWordSearch: false,
                    className: "search-highlight"
                });
                // Прокручиваем к первому совпадению
                const firstMatch = docContent.querySelector('.search-highlight');
                if (firstMatch) {
                    firstMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }
        }
    }

    let searchTimeout;
    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(async () => {
            const query = searchInput.value;
            if (query) {
                const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
                const results = await response.json();
                
                searchResults.innerHTML = results.map(file => `
                    <div class="tree-item">
                        <div class="tree-content" data-path="${file.path}" data-query="${query}">
                            <span class="tree-icon file-icon">📄</span>
                            ${file.name}
                        </div>
                    </div>
                `).join('');
                
                searchResults.style.display = 'block';
                
                document.querySelectorAll('.search-results .tree-content').forEach(item => {
                    item.addEventListener('click', () => {
                        loadContent(item.dataset.path, item.dataset.query);
                    });
                });
            } else {
                searchResults.style.display = 'none';
                marker.unmark();
            }
        }, 300);
    });

    loadTree();
});