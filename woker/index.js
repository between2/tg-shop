进口 { handleApi } 从……起"./api.js";
进口 { handleAuth } 从……起"./auth.js";
进口 { handleTelegram } 从……起"./telegram.js";

出口 默认 {
  异步 取来(请求, env, CTX) {
    尝试 {
      ConstURL=新的 URL(请求.URL);

      // 首页
      如果 (URL.路径名==="/") {
        返回 JSON({
          成功: 正确,
          姓名: "TG车间API",
          版本: "1.0.0"
        });
      }

      // 商品接口
      如果 (URL.路径名.startswith("/products")||
          URL.路径名.startswith("/product")) {
        返回 handleApi(请求, env);
      }

      // 后台接口
      如果 (URL.路径名.startswith("/admin")) {
        返回 handleAuth(请求, env);
      }

      //电报网钩
      如果 (URL.路径名==="/电报") {
        返回 handleTelegram(请求, env);
      }

      返回 JSON({
        成功: 假的,
        消息: "找不到"
      }, 404);

    } 赶上 (e) {

      返回 JSON({
        成功: 假的,
        误差: e.消息
      }, 500);

    }
  }
};

功能 JSON(数据, 状态=200) {
  返回 新的 响应(
    JSON.使字符串化(数据, null, 2),
    {
      状态,
      页眉: {
        "内容类型": "application/json；charset=UTF-8"
      }
    }
  );
}
          
