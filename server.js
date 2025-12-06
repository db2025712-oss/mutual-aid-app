const express = require('express'
);
const path = require('path'
);
const cors = require('cors'
);
const fs = require('fs'
);

const app = express
();

// 端口可以用环境变量 PORT，也可以默认 3000
const PORT = process.env.PORT || 3000
;

// 存盘相关：把订单写进本地文件 data/orders.json
const DATA_DIR = path.join(__dirname, 'data'
);
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json'
);

// 确保 data 目录存在
if (!fs.existsSync(DATA_DIR
)) {
  fs.
mkdirSync(DATA_DIR, { recursive: true
 });
}

// 内存里的订单数组和自增 ID
let
 orders = [];
let nextOrderId = 1
;

// 从文件中加载订单
function loadOrdersFromFile(
) {
  try
 {
    if (!fs.existsSync(ORDERS_FILE
)) {
      console.log('订单文件不存在，先从空列表开始。'
);
      orders = [];
      nextOrderId = 
1
;
      return
;
    }

    const raw = fs.readFileSync(ORDERS_FILE, 'utf-8'
);
    if (!raw.trim
()) {
      orders = [];
      nextOrderId = 
1
;
      console.log('订单文件为空，先从空列表开始。'
);
      return
;
    }

    const data = JSON.parse
(raw);

    if (Array.isArray(data.orders
)) {
      orders = data.
orders
;
    } 
else if (Array.isArray
(data)) {
      // 兼容旧格式：文件里直接是数组
      orders = data;
    } 
else
 {
      orders = [];
    }

    // 计算下一个 ID
    let maxId = 0
;
    for (const o of
 orders) {
      if (o && typeof o.id === 'number' && o.id
 > maxId) {
        maxId = o.
id
;
      }
    }
    nextOrderId = (data.
nextOrderId && typeof data.nextOrderId === 'number'
)
      ? data.
nextOrderId
      : maxId + 
1
;

    console.log(`已从文件加载 ${orders.length} 条订单，nextOrderId = ${nextOrderId}
`);
  } 
catch
 (err) {
    console.error('加载订单文件时出错：'
, err);
    orders = [];
    nextOrderId = 
1
;
  }
}

// 把当前订单写回文件
function saveOrdersToFile(
) {
  try
 {
    const
 payload = {
      nextOrderId,
      orders
    };
    fs.
writeFileSync(ORDERS_FILE, JSON.stringify(payload, null, 2), 'utf-8'
);
  } 
catch
 (err) {
    console.error('保存订单到文件时出错：'
, err);
  }
}

// 启动时先尝试读取历史订单
loadOrdersFromFile
();

// 中间件
app.
use(cors
());
app.
use(express.json
());
app.
use(express.urlencoded({ extended: true
 }));

// 创建订单（用户提交表单时调用）
app.
post('/api/orders', (req, res
) => {
  try
 {
    const
 {
      category,          
// 服务类别
      location,          
// 办理城市/区域
      preferredTime,     
// 希望时间
      urgency,           
// 紧急程度
      description,       
// 需求说明
      needInterpreter,   
// 是否需要翻译
      budgetRange,       
// 预算区间
      contactType,       
// 联系方式类型（wechat / line / email / phone)
      contactValue,      
// 联系方式具体内容
      fromCountry        
// 人在日本/国内/其他
    } = req.
body
 || {};

    if
 (!category || !contactValue) {
      return res.status(400).json
({
        ok: false
,
        message: '服务类别和联系方式是必填项'
      });
    }

    const
 newOrder = {
      id
: nextOrderId++,
      createdAt: new Date().toISOString
(),
      status: 'new', // new / quoted / assigned / in_progress / done / cancelled
      category,
      location: location || ''
,
      preferredTime: preferredTime || ''
,
      urgency: urgency || 'normal'
,
      description: description || ''
,
      needInterpreter
: !!needInterpreter,
      budgetRange: budgetRange || ''
,
      contactType: contactType || 'unknown'
,
      contactValue,
      fromCountry: fromCountry || ''
,
      internal
: {
        suggestedPrice: ''
,
        deposit: ''
,
        assignedHelperId: null
,
        notes: ''
      }
    };

    orders.
push
(newOrder);
    saveOrdersToFile(); // 每次创建订单后立刻写盘

    res.
status(201).json
({
      ok: true
,
      order
: newOrder
    });
  } 
catch
 (err) {
    console.error('创建订单错误:'
, err);
    res.
status(500).json
({
      ok: false
,
      message: '服务器内部异常'
    });
  }
});

// 获取订单列表（管理端用）
app.
get('/api/orders', (req, res
) => {
  const { status } = req.query
;
  let
 list = orders;

  if
 (status) {
    list = list.
filter(o => o.status
 === status);
  }

  res.
json
({
    ok: true
,
    orders
: list
  });
});

// 获取单个订单详情（管理端用）
app.
get('/api/orders/:id', (req, res
) => {
  const id = Number(req.params.id
);
  const order = orders.find(o => o.id
 === id);

  if
 (!order) {
    return res.status(404).json
({
      ok: false
,
      message: '找不到对应订单'
    });
  }

  res.
json
({
    ok: true
,
    order
  });
});

// 静态文件（前端页面）
// 默认从 /public 目录提供文件
app.
use(express.static(path.join(__dirname, 'public'
)));

// 兜底：任何没匹配到的请求，都返回 index.html
app.
use((req, res
) => {
  res.
sendFile(path.join(__dirname, 'public', 'index.html'
));
});

app.
listen(PORT, () =>
 {
  console.log(`Mutual Aid app listening on http://localhost:${PORT}
`);
});