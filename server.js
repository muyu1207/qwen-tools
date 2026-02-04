const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');

const app = express();
const PORT = 9939;

// 中间件
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// API 端点
const API_ENDPOINT = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation';

// 输出目录
const OUTPUT_DIR = path.join(__dirname, 'outputs');
const DATA_DIR = path.join(__dirname, 'data');

// 确保目录存在
[OUTPUT_DIR, DATA_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// 数据文件路径
const ARTICLES_FILE = path.join(DATA_DIR, 'articles.json');

// ============ 图像生成功能 ============

// 生成图片
app.post('/api/image/generate', async (req, res) => {
  const { prompt, size = "1024*1024" } = req.body;

  if (!prompt) {
    return res.status(400).json({ success: false, message: 'Prompt is required' });
  }

  try {
    const response = await axios.post(API_ENDPOINT, {
      model: 'qwen-vl-max',
      input: {
        prompt,
        image_url: ''
      },
      parameters: {
        size
      }
    }, {
      headers: {
        'Authorization': `Bearer sk-1fc4e756834e43f5929100a728cd03b1`,
        'Content-Type': 'application/json'
      },
      responseType: 'arraybuffer'
    });

    // 保存图片
    const timestamp = Date.now();
    const filename = `image_${timestamp}.png`;
    const filepath = path.join(OUTPUT_DIR, filename);
    fs.writeFileSync(filepath, response.data);

    res.json({
      success: true,
      message: 'Image generated successfully',
      image: {
        filename,
        url: `/outputs/${filename}`
      }
    });
  } catch (error) {
    console.error('Generation error:', error);
    res.status(500).json({
      success: false,
      message: error.response?.data?.message || error.message || 'Generation failed'
    });
  }
});

// 获取生成的图片列表
app.get('/api/images', (req, res) => {
  try {
    const files = fs.readdirSync(OUTPUT_DIR)
      .filter(f => f.endsWith('.png'))
      .map(f => {
        const filepath = path.join(OUTPUT_DIR, f);
        const stats = fs.statSync(filepath);
        return {
          filename: f,
          url: `/outputs/${f}`,
          size: stats.size,
          created: stats.mtime
        };
      })
      .sort((a, b) => b.created - a.created);

    res.json({ success: true, images: files });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to list images' });
  }
});

// 删除图片
app.delete('/api/images/:filename', (req, res) => {
  const { filename } = req.params;
  const filepath = path.join(OUTPUT_DIR, filename);

  try {
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
      res.json({ success: true, message: 'Image deleted' });
    } else {
      res.status(404).json({ success: false, message: 'Image not found' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Delete failed' });
  }
});

// ============ 写作功能 ============

// 读取文章
function readArticles() {
  try {
    return JSON.parse(fs.readFileSync(ARTICLES_FILE, 'utf8'));
  } catch (err) {
    return [];
  }
}

// 保存文章
function saveArticles(articles) {
  fs.writeFileSync(ARTICLES_FILE, JSON.stringify(articles, null, 2));
}

// 生成文章
app.post('/api/articles/generate', async (req, res) => {
  const { topic, style = 'story', chapters = 5, length = 1000 } = req.body;

  if (!topic) {
    return res.status(400).json({ success: false, message: 'Topic is required' });
  }

  try {
    const chapters = [];
    
    for (let i = 1; i <= chapters; i++) {
      const prompt = `写一篇${topic}的第${i}章（${style}风格，约${length}字）。要有连贯的情节。`;
      
      const response = await axios.post(API_ENDPOINT, {
        model: 'qwen-vl-max',
        input: { prompt },
        parameters: { max_new_tokens: length }
      }, {
        headers: {
          'Authorization': `Bearer sk-1fc4e756834e43f5929100a728cd03b1`,
          'Content-Type': 'application/json'
        }
      });

      chapters.push({
        chapter: i,
        title: `第${i}章`,
        content: response.data.output.choices[0].message.content,
        created_at: new Date().toISOString()
      });

      // 防止请求过快
      if (i < chapters) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    const article = {
      id: Date.now().toString(),
      topic,
      style,
      chapters,
      created_at: new Date().toISOString(),
      status: 'completed'
    };

    // 保存文章
    const articles = readArticles();
    articles.push(article);
    saveArticles(articles);

    res.json({ success: true, article });
  } catch (error) {
    console.error('Generation error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.response?.data?.message || error.message 
    });
  }
});

// 获取所有文章
app.get('/api/articles', (req, res) => {
  try {
    const articles = readArticles();
    res.json({ success: true, articles: articles.reverse() });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 获取单个文章
app.get('/api/articles/:id', (req, res) => {
  try {
    const articles = readArticles();
    const article = articles.find(a => a.id === req.params.id);
    
    if (!article) {
      return res.status(404).json({ success: false, message: 'Article not found' });
    }

    res.json({ success: true, article });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 删除文章
app.delete('/api/articles/:id', (req, res) => {
  try {
    const articles = readArticles();
    const index = articles.findIndex(a => a.id === req.params.id);
    
    if (index === -1) {
      return res.status(404).json({ success: false, message: 'Article not found' });
    }

    articles.splice(index, 1);
    saveArticles(articles);
    
    res.json({ success: true, message: 'Article deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 导出文章为 Markdown
app.get('/api/articles/:id/export', (req, res) => {
  const format = req.query.format || 'markdown';
  
  try {
    const articles = readArticles();
    const article = articles.find(a => a.id === req.params.id);
    
    if (!article) {
      return res.status(404).json({ success: false, message: 'Article not found' });
    }

    let markdown = `# ${article.topic}\n\n`;
    article.chapters.forEach(chapter => {
      markdown += `## ${chapter.title}\n\n${chapter.content}\n\n`;
    });

    if (format === 'picturebook') {
      markdown = `# ${article.topic}（绘本版）\n\n`;
      article.chapters.forEach((chapter, index) => {
        markdown += `### 第${index + 1}页\n\n${chapter.content}\n\n---\n\n`;
      });
    }

    res.set('Content-Type', 'text/markdown; charset=utf-8');
    res.send(markdown);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 静态文件服务
app.use('/outputs', express.static(OUTPUT_DIR));

// 启动服务器
app.listen(PORT, () => {
  console.log(`Qwen Tools running at http://localhost:${PORT}`);
});
