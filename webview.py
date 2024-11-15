from flask import Flask, render_template, request, jsonify
from pathlib import Path
import mistune
from pygments import highlight
from pygments.lexers import get_lexer_by_name
from pygments.formatters import html
from os import system as do, path
import argparse

parser = argparse.ArgumentParser()
parser.add_argument('--root', type=str, required=True, help='Path to the root documentation folder')
args = parser.parse_args()

app = Flask(__name__)

class HighlightRenderer(mistune.HTMLRenderer):
    def block_code(self, code, info=None):
        if not info:
            return f'<pre><code>{mistune.escape(code)}</code></pre>'
        try:
            lexer = get_lexer_by_name(info, stripall=True)
            formatter = html.HtmlFormatter()
            return highlight(code, lexer, formatter)
        except:
            return f'<pre><code>{mistune.escape(code)}</code></pre>'

class DocumentationBrowser:
    def __init__(self, root_path):
        self.root_path = Path(root_path)
        renderer = HighlightRenderer()
        self.markdown = mistune.create_markdown(renderer=renderer)
        
    def get_content(self, file_path):
        full_path = self.root_path / file_path
        if full_path.exists() and full_path.suffix == '.md':
            content = full_path.read_text(encoding='utf-8')
            return self.markdown(content)
        return None

    def get_tree_structure(self):
        def build_tree(path):
            tree = []
            items = sorted(path.iterdir(), key=lambda x: (not x.is_dir(), x.name.lower()))
            
            for item in items:
                if item.is_dir():
                    # Получаем содержимое папки
                    children = build_tree(item)
                    # Если в папке только одна папка, объединяем с родительской
                    if len(children) == 1 and children[0]['type'] == 'directory':
                        children[0]['name'] = f"{item.name}/{children[0]['name']}"
                        tree.append(children[0])  # Добавляем только одну папку
                    else:
                        node = {
                            'name': item.name,
                            'path': str(item.relative_to(self.root_path)),
                            'type': 'directory',
                            'children': children
                        }
                        tree.append(node)
                elif item.suffix == '.md':
                    node = {
                        'name': item.name,
                        'path': str(item.relative_to(self.root_path)),
                        'type': 'file'
                    }
                    tree.append(node)
            return tree
        
        return build_tree(self.root_path)

    def search(self, query):
        results = []
        for md_file in self.root_path.rglob('*.md'):
            content = md_file.read_text(encoding='utf-8')
            if query.lower() in content.lower():
                results.append({
                    'path': str(md_file.relative_to(self.root_path)),
                    'name': md_file.name,
                    'type': 'file'
                })
        return results

docs_browser: DocumentationBrowser;

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/tree')
def get_tree():
    return jsonify(docs_browser.get_tree_structure())

@app.route('/api/content/<path:file_path>')
def get_content(file_path):
    content = docs_browser.get_content(file_path)
    if content:
        return jsonify({'content': content})
    return jsonify({'error': 'File not found'}), 404

@app.route('/api/search')
def search():
    query = request.args.get('q', '')
    if query:
        return jsonify(docs_browser.search(query))
    return jsonify([])

def run_app(docs_path):
    global docs_browser
    docs_browser = DocumentationBrowser(docs_path)
    app.run(debug=True)

if __name__ == '__main__':
    run_app(args.root)