// =============================================================================
// 待办事项：JavaScript 逻辑（连接后端 API）
//
// 需求实现点：
// 1) 页面加载时，从 /api/todos 获取数据（GET）
// 2) 添加任务时，发送到 /api/todos（POST）
// 3) 标记完成时，发送到 /api/todos/<id>（PUT）
// 4) 删除任务时，发送到 /api/todos/<id>（DELETE）
// =============================================================================

(function () {
  var input = document.getElementById("todo-input"); // 输入框
  var addBtn = document.getElementById("todo-add"); // 添加按钮
  var list = document.getElementById("todo-list"); // 任务列表容器 <ul>

  // 待办统计展示区域（数字会实时更新）
  var totalEl = document.getElementById("todo-total"); // 总任务数
  var doneEl = document.getElementById("todo-done"); // 已完成数
  var todoEl = document.getElementById("todo-todo"); // 待完成数

  // 后端服务地址（你的 Flask 运行在本机 5000 端口）
  var API_BASE = "http://demoncm.pythonanywhere.com";

  function apiUrl(path) {
    // 统一拼接 URL，避免到处写重复字符串
    return API_BASE + path;
  }

  function assertOk(res) {
    // fetch 不会因为 404/500 自动抛错，所以这里统一处理非 2xx 的情况
    if (!res.ok) {
      var err = new Error("请求失败，状态码：" + res.status);
      err.status = res.status;
      throw err;
    }
    return res;
  }

  function updateStats() {
    // 关键：实时统计（添加/删除/勾选变化后都要调用）
    var items = Array.prototype.slice.call(list.querySelectorAll("li.todo-item"));

    var total = items.length;
    var done = items.reduce(function (acc, li) {
      var checkEl = li.querySelector("input.todo-check");
      return acc + (checkEl && checkEl.checked ? 1 : 0);
    }, 0);
    var todo = total - done;

    // 只更新数字，不改页面其它内容
    if (totalEl) totalEl.textContent = String(total);
    if (doneEl) doneEl.textContent = String(done);
    if (todoEl) todoEl.textContent = String(todo);
  }

  function renderTask(todo) {
    // 只负责「把一条任务渲染到页面上」
    // todo 结构来自后端：{ id: number, text: string, done: boolean }
    var value = String(todo && todo.text ? todo.text : "").trim();
    if (!value) return; // 没有内容就不渲染

    var li = document.createElement("li");
    li.className = "todo-item";
    li.dataset.id = String(todo.id); // 关键：把后端 id 存到 DOM 上，后续 PUT/DELETE 要用

    var check = document.createElement("input");
    check.type = "checkbox";
    check.className = "todo-check";
    check.setAttribute("aria-label", "标记完成");
    check.checked = !!todo.done;

    // 关键：勾选/取消勾选时，调用后端 PUT /api/todos/<id>
    check.addEventListener("change", function () {
      var id = li.dataset.id;
      var newDone = !!check.checked;

      fetch(apiUrl("/api/todos/" + encodeURIComponent(id)), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done: newDone }),
      })
        .then(assertOk)
        .then(function () {
          // 后端更新成功后，刷新统计数字
          updateStats();
        })
        .catch(function (err) {
          // 如果失败：把勾选状态还原回去，避免「前端看起来改了，但后端没改」
          check.checked = !newDone;
          alert("更新失败，请确认后端已启动。(" + err.message + ")");
        });
    });

    var span = document.createElement("span");
    span.className = "todo-text";
    span.textContent = value;

    var del = document.createElement("button");
    del.type = "button";
    del.className = "todo-delete";
    del.textContent = "删除";

    del.addEventListener("click", function () {
      // 关键：删除时，调用后端 DELETE /api/todos/<id>
      var id = li.dataset.id;

      fetch(apiUrl("/api/todos/" + encodeURIComponent(id)), { method: "DELETE" })
        .then(assertOk)
        .then(function () {
          li.remove(); // 后端删除成功后，再从页面移除
          updateStats(); // 删除后更新统计
        })
        .catch(function (err) {
          alert("删除失败，请确认后端已启动。(" + err.message + ")");
        });
    });

    li.appendChild(check);
    li.appendChild(span);
    li.appendChild(del);
    list.appendChild(li);

    updateStats(); // 渲染一条后立刻更新统计
  }

  function loadTasksFromApi() {
    // 关键：页面加载时，从后端 GET /api/todos 拉取数据
    fetch(apiUrl("/api/todos"))
      .then(assertOk)
      .then(function (res) {
        return res.json();
      })
      .then(function (todos) {
        // 先清空列表，再渲染（避免重复）
        list.innerHTML = "";

        if (Array.isArray(todos)) {
          todos.forEach(function (t) {
            renderTask({
              id: t && t.id,
              text: t && t.text,
              done: !!(t && t.done),
            });
          });
        }

        updateStats(); // 渲染结束后再更新一次，确保数字正确
      })
      .catch(function (err) {
        updateStats(); // 即使失败，也让统计显示为 0/0/0
        alert("加载待办失败，请确认后端已启动。(" + err.message + ")");
      });
  }

  // 点击「添加」
  addBtn.addEventListener("click", function () {
    var text = input.value;
    var value = (text != null ? String(text) : "").trim();
    if (!value) return;

    // 关键：给用户一个「可见反馈」，避免看起来“没反应”
    // - 禁用按钮、防止连续点击重复提交
    // - 临时改按钮文字，提示正在请求后端
    var oldBtnText = addBtn.textContent;
    addBtn.disabled = true;
    addBtn.textContent = "添加中...";

    // 关键：添加任务时，POST /api/todos
    fetch(apiUrl("/api/todos"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: value, done: false }),
    })
      .then(assertOk)
      .then(function (res) {
        return res.json();
      })
      .then(function (created) {
        // 后端返回的新任务里会带 id，渲染时要用它
        renderTask({ id: created.id, text: created.text, done: !!created.done });
        input.value = "";
        input.focus();

        // 请求成功，恢复按钮状态
        addBtn.disabled = false;
        addBtn.textContent = oldBtnText;
      })
      .catch(function (err) {
        // 请求失败，也要恢复按钮状态
        addBtn.disabled = false;
        addBtn.textContent = oldBtnText;

        // 关键：把错误打印到控制台，便于你定位（比如 CORS / 后端未启动 / 500 等）
        console.error("添加待办失败：", err);
        alert("添加失败，请确认后端已启动，或用 Live Server 打开页面。(" + err.message + ")");
      });
  });

  // 回车添加
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      addBtn.click(); // 复用「点击添加」的逻辑，避免写两遍
    }
  });

  loadTasksFromApi(); // 关键：页面加载后先从后端拉取历史任务
})(); // 右大括号结束函数体，右括号结束函数表达式，() 表示立刻调用这个函数，分号结束整条语句
