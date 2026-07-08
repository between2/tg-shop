export async function handleTelegramWebhook(request, env) {
  try {
    const update = await request.json();

    // 只处理文本消息
    if (update.message && update.message.text) {
      const chatId = update.message.chat.id;
      const text = update.message.text;
      const tgUser = update.message.from;

      // 1. 自动注册/更新用户 (适配你新增的 first_name 和 language)
      // 注：Telegram 返回的是 language_code
      await env.DB.prepare(
        `INSERT INTO users (tg_id, username, first_name, language) VALUES (?, ?, ?, ?) 
         ON CONFLICT(tg_id) DO UPDATE SET username = ?, first_name = ?, language = ?`
      ).bind(
        tgUser.id.toString(), 
        tgUser.username || '', 
        tgUser.first_name || '', 
        tgUser.language_code || '',
        tgUser.username || '', 
        tgUser.first_name || '', 
        tgUser.language_code || ''
      ).run();

      // 2. 指令路由
      if (text.startsWith('/start')) {
        const welcomeMsg = `你好，${tgUser.first_name || '朋友'}！欢迎来到电报商城 🛒\n\n` +
                           `输入 /shop 查看在售商品\n` +
                           `输入 /help 获取帮助`;
        await sendMessage(env.TG_BOT_TOKEN, chatId, welcomeMsg);
      } 
      
      // 查看商品列表 (适配 status = 1 并在菜单中展示分类)
      else if (text.startsWith('/shop')) {
        const { results } = await env.DB.prepare(
          "SELECT * FROM products WHERE stock > 0 AND status = 1 ORDER BY category ASC"
        ).all();
        
        if (results.length === 0) {
          await sendMessage(env.TG_BOT_TOKEN, chatId, "当前没有在售商品。");
        } else {
          let msg = "🔥 **当前在售商品** 🔥\n\n";
          let currentCategory = "";

          results.forEach(p => {
            // 按分类分组显示
            if (p.category !== currentCategory) {
              currentCategory = p.category;
              msg += `🏷️ **【${currentCategory || '其它'}】**\n`;
            }
            msg += `▪️ **${p.name}**\n   简介: ${p.description || '无'}\n   价格: 💰$${p.price} | 库存: ${p.stock}\n   购买输入: /buy_${p.id}\n\n`;
          });
          await sendMessage(env.TG_BOT_TOKEN, chatId, msg);
        }
      }
      
      // 购买商品 (适配你的 orders 表结构，包含自动生成 order_no)
      else if (text.startsWith('/buy_')) {
        const productId = parseInt(text.split('_')[1]);
        if (isNaN(productId)) {
          return await sendMessage(env.TG_BOT_TOKEN, chatId, "❌ 错误的商品ID");
        }

        // 查询商品是否存在及库存
        const product = await env.DB.prepare("SELECT * FROM products WHERE id = ? AND status = 1").bind(productId).first();
        
        if (!product) {
          return await sendMessage(env.TG_BOT_TOKEN, chatId, "❌ 商品不存在或已下架");
        }
        if (product.stock <= 0) {
          return await sendMessage(env.TG_BOT_TOKEN, chatId, "❌ 商品库存不足");
        }

        // 根据 tg_id 查出我们数据库里的 user_id
        const user = await env.DB.prepare("SELECT id FROM users WHERE tg_id = ?").bind(tgUser.id.toString()).first();

        // 生成唯一订单号 (规则：时间戳 + 4位随机数)
        const orderNo = `ORD${Date.now()}${Math.floor(1000 + Math.random() * 9000)}`;
        const quantity = 1;
        const total = product.price * quantity;

        // 写入订单表
        await env.DB.prepare(
          `INSERT INTO orders (order_no, user_id, product_id, quantity, total, status) VALUES (?, ?, ?, ?, ?, 'pending')`
        ).bind(orderNo, user.id, product.id, quantity, total).run();

        // 返回给用户订单信息
        const orderMsg = `✅ **订单已创建**\n\n` +
                         `订单编号: \`${orderNo}\`\n` +
                         `购买商品: ${product.name}\n` +
                         `应付金额: **$${total}**\n\n` +
                         `⚠️ 支付对接中，请联系管理员处理。`;
        await sendMessage(env.TG_BOT_TOKEN, chatId, orderMsg);
      }
    }
    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Webhook Error:", error);
    return new Response("Error", { status: 500 });
  }
}

// 封装发送 TG 消息的函数
async function sendMessage(token, chatId, text) {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: 'Markdown'
    })
  });
}
