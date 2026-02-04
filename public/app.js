// API 端点
const API_BASE = 'http://localhost:9939/api';

// 状态
let currentImage = null;
let imageHistory = [];
let articles = [];
let currentArticle = null;

// 切换标签页
function switchTab(tab) {
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach(t => t.classList.remove('active'));
  
  const panels = document.querySelectorAll('.panel');
  panels.forEach(p => p.classList.remove('active'));
  
  event.target.classList.add('active');
  
  if (tab === 'image') {
    document.getElementById('imagePanel').classList.add('active');
    loadImageHistory();
  } else if (tab === 'writer') {
    document.getElementById('writerPanel').classList.add('active');
    loadArticles();
  }
}

// ============ 图像生成功能 ============

// 生成图片
async function generateImage() {
  const prompt = document.getElementById('prompt').value;
  const size = document.getElementById('size').value;
  const generateBtn = document.getElementById('generateBtn');

  if (!prompt.trim()) {
    alert('请输入提示词！');
    return;
  }

  // 禁用按钮
  generateBtn.disabled = true;
  generateBtn.textContent = '🎨 生成中...';

  try {
    const response = await fetch(`${API_BASE}/image/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, size })
    });

    const result = await response.json();

    if (result.success) {
      currentImage = result.image;
      displayResult(result.image);
      
      // 添加到历史
      imageHistory.unshift({
        filename: result.image.filename,
        url: result.image.url,
        prompt: prompt,
        timestamp: new Date()
      });
      renderImageHistory();
    } else {
      showError(result.message);
    }
  } catch (error) {
    console.error('Generate error:', error);
    showError('生成失败，请重试');
  } finally {
    generateBtn.disabled = false;
    generateBtn.textContent = '🎨 生成图片';
  }
}

// 显示结果
function displayResult(image) {
  const container = document.getElementById('resultContainer');
  const actions = document.getElementById('resultActions');
  
  container.innerHTML = `
    <img src="${image.url}" alt="生成的图片" style="max-width: 100%; border-radius: 10px;">
  `;
  
  actions.style.display = 'flex';
}

// 显示错误
function showError(message) {
  const container = document.getElementById('resultContainer');
  const actions = document.getElementById('resultActions');
  
  container.innerHTML = `
    <div class="placeholder" style="color: #dc3545; background: #f8d7da; padding: 15px; border-radius: 8px; border: 1px solid #f5c6cb;">
      ❌ ${message}
    </div>
  `;
  
  actions.style.display = 'none';
}

// 下载图片
function downloadImage() {
  if (!currentImage) {
    alert('没有可下载的图片');
    return;
  }
  
  window.open(currentImage.url, '_blank');
}

// 清空结果
function clearResults() {
  currentImage = null;
  document.getElementById('resultContainer').innerHTML = '<p class="placeholder">生成的图片将显示在这里...</p>';
  document.getElementById('resultActions').style.display = 'none';
}

// 渲染历史记录
function renderImageHistory() {
  const list = document.getElementById('historyList');
  
  if (imageHistory.length === 0) {
    list.innerHTML = '<p class="placeholder">暂无历史记录</p>';
    return;
  }

  list.innerHTML = imageHistory.map(item => `
    <div class="history-item">
      <div class="history-item-info">
        <div class="history-item-prompt">${escapeHtml(item.prompt)}</div>
        <div class="history-item-date">${formatDate(item.timestamp)}</div>
      </div>
      <a href="${item.url}" target="_blank" class="history-item-url">🖼️ 查看</a>
    </div>
  `).join('');
}

// 格式化日期
function formatDate(date) {
  const d = new Date(date);
  return d.toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// 转义 HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============ 写作功能 ============

// 加载文章列表
async function loadArticles() {
  try {
    const response = await fetch(`${API_BASE}/articles`);
    const data = await response.json();
    
    if (data.success) {
      articles = data.articles;
      renderArticleList();
    }
  } catch (error) {
    console.error('Load articles error:', error);
  }
}

// 创建文章
async function createArticle() {
  const topic = document.getElementById('topic').value;
  const style = document.getElementById('style').value;
  const chapters = parseInt(document.getElementById('chapters').value);
  const length = parseInt(document.getElementById('length').value);
  const createBtn = document.getElementById('createBtn');

  if (!topic.trim()) {
    alert('请输入文章主题');
    return;
  }

  // 显示加载
  showLoading('AI 正在创作中，这可能需要几分钟...');

  try {
    const response = await fetch(`${API_BASE}/articles/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, style, chapters, length })
    });

    const result = await response.json();

    if (result.success) {
      alert('文章生成成功！');
      await loadArticles();
      hideDetail();
    } else {
      alert('生成失败：' + result.message);
    }
  } catch (error) {
    console.error('Create article error:', error);
    alert('生成失败，请重试');
  } finally {
    createBtn.disabled = false;
    hideLoading();
  }
}

// 显示文章详情
async function showArticleDetail(articleId) {
  try {
    const response = await fetch(`${API_BASE}/articles/${articleId}`);
    const data = await response.json();

    if (data.success) {
      currentArticle = data.article;
      renderArticleDetail();
    }
  } catch (error) {
    console.error('Show article error:', error);
  }
}

// 渲染文章列表
function renderArticleList() {
  const list = document.getElementById('articleList');

  if (articles.length === 0) {
    list.innerHTML = '<p class="placeholder">暂无文章</p>';
    return;
  }

  list.innerHTML = articles.map(article => `
    <div class="article-item" onclick="showArticleDetail('${article.id}')">
      <h3>${article.topic}</h3>
      <p>${article.style} · ${article.chapters.length}章 · ${new Date(article.created_at).toLocaleDateString()}</p>
      <div class="article-item-meta">
        <span>状态: ${article.status === 'completed' ? '✅ 已完成' : '⏸️ 生成中'}</span>
      </div>
    </div>
  `).join('');
}

// 渲染文章详情
function renderArticleDetail() {
  const detailSection = document.getElementById('articleDetail');
  const contentSection = document.getElementById('articleContent');
  const titleElement = document.getElementById('articleTitle');

  if (!currentArticle) {
    return;
  }

  titleElement.textContent = currentArticle.topic;

  let contentHTML = '';
  
  currentArticle.chapters.forEach((chapter, index) => {
    contentHTML += `
      <div class="chapter">
        <h4>第${index + 1}章</h4>
        <p>${chapter.content.replace(/\n/g, '<br>')}</p>
      </div>
    `;
  });

  contentSection.innerHTML = contentHTML;
  detailSection.style.display = 'block';
}

// 隐藏详情
function hideDetail() {
  document.getElementById('articleDetail').style.display = 'none';
  currentArticle = null;
}

// 导出文章
async function exportArticle(format) {
  if (!currentArticle) {
    alert('请先选择一篇文章');
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/articles/${currentArticle.id}/export${format === 'picturebook' ? '/picturebook' : ''}`);
    
    if (format === 'markdown') {
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${currentArticle.topic}.md`;
      a.click();
      window.URL.revokeObjectURL(url);
    } else {
      const html = await response.text();
      const blob = new Blob([html], { type: 'text/html' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${currentArticle.topic}_绘本.html`;
      a.click();
      window.URL.revokeObjectURL(url);
    }
  } catch (error) {
    console.error('Export error:', error);
    alert('导出失败，请重试');
  }
}

// 删除文章
async function deleteArticle() {
  if (!currentArticle) {
    alert('请先选择一篇文章');
    return;
  }

  if (!confirm(`确定要删除文章"${currentArticle.topic}"吗？`)) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/articles/${currentArticle.id}`, {
      method: 'DELETE'
    });

    const result = await response.json();

    if (result.success) {
      alert('文章已删除');
      await loadArticles();
      hideDetail();
    } else {
      alert('删除失败：' + result.message);
    }
  } catch (error) {
    console.error('Delete article error:', error);
    alert('删除失败，请重试');
  }
}

// 显示加载遮罩
function showLoading(message) {
  const overlay = document.getElementById('loading');
  overlay.querySelector('p').textContent = message;
  overlay.style.display = 'flex';
}

// 隐藏加载遮罩
function hideLoading() {
  document.getElementById('loading').style.display = 'none';
}

// 页面加载时初始化
window.addEventListener('load', () => {
  loadImageHistory();
  loadArticles();
});
