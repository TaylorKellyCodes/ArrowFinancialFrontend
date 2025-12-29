const API_BASE = window.CONFIG.API_BASE;

const state = {
  user: null,
  csrfToken: null,
  transactions: []
};

const els = {
  loginForm: document.getElementById("login-form"),
  logoutBtn: document.getElementById("logout-btn"),
  authError: document.getElementById("auth-error"),
  controls: document.getElementById("controls"),
  tableSection: document.getElementById("table-section"),
  transactionsBody: document.getElementById("transactions-body"),
  transactionForm: document.getElementById("transaction-form"),
  tableError: document.getElementById("table-error"),
  userInfo: document.getElementById("user-info"),
  filterType: document.getElementById("filter-type"),
  filterStart: document.getElementById("filter-start"),
  filterEnd: document.getElementById("filter-end"),
  applyFilters: document.getElementById("apply-filters"),
  quickButtons: document.querySelectorAll(".quick-btn")
};

function setAuthUI(loggedIn) {
  els.controls.hidden = !loggedIn;
  els.tableSection.hidden = !loggedIn;
  els.logoutBtn.hidden = !loggedIn;
  els.authError.textContent = "";
  if (loggedIn) {
    els.userInfo.textContent = `${state.user.email} (${state.user.role})`;
  } else {
    els.userInfo.textContent = "";
  }
}

async function apiFetch(path, options = {}) {
  const opts = {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  };
  const method = (opts.method || "GET").toUpperCase();
  if (!["GET", "HEAD"].includes(method) && state.csrfToken) {
    opts.headers["X-CSRF-Token"] = state.csrfToken;
  }
  const res = await fetch(`${API_BASE}${path}`, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data?.error?.message || "Request failed";
    throw new Error(message);
  }
  return data;
}

async function login(email, password) {
  const data = await apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
  state.user = data.user;
  state.csrfToken = data.csrfToken;
  setAuthUI(true);
  await loadTransactions();
}

async function logout() {
  await apiFetch("/auth/logout", { method: "POST" });
  state.user = null;
  state.csrfToken = null;
  state.transactions = [];
  setAuthUI(false);
  renderTransactions();
}

async function loadTransactions() {
  const params = new URLSearchParams();
  if (els.filterType.value) params.append("transactionType", els.filterType.value);
  if (els.filterStart.value) {
    // Convert from YYYY-MM-DD to DD/MM/YYYY for backend
    params.append("startDate", inputFormatToDate(els.filterStart.value));
  }
  if (els.filterEnd.value) {
    // Convert from YYYY-MM-DD to DD/MM/YYYY for backend
    params.append("endDate", inputFormatToDate(els.filterEnd.value));
  }
  const data = await apiFetch(`/transactions?${params.toString()}`, { method: "GET" });
  state.transactions = data.transactions || [];
  renderTransactions();
}

function computeRunningTotals(transactions) {
  // Calculate running totals from bottom to top (oldest to newest)
  // Since transactions are displayed newest first, we reverse, calculate, then reverse back
  const reversed = [...transactions].reverse();
  const totals = [];
  let acc = 0;
  reversed.forEach((tx) => {
    acc += tx.amount; // Negative amounts will subtract automatically
    totals.push(acc);
  });
  // Reverse totals back to match display order (newest first)
  return totals.reverse();
}

function renderTransactions() {
  els.transactionsBody.innerHTML = "";
  const totals = computeRunningTotals(state.transactions);
  state.transactions.forEach((tx, idx) => {
    const tr = document.createElement("tr");
    tr.dataset.id = tx._id;
    tr.draggable = true;

    tr.innerHTML = `
      <td class="drag-handle">⇅</td>
      <td>${formatDate(tx.date)}</td>
      <td>${tx.transactionType}</td>
      <td>${tx.amount}</td>
      <td>${totals[idx]}</td>
      <td><input type="checkbox" data-field="confirmationTaylor" ${tx.confirmationTaylor ? "checked" : ""}></td>
      <td><input type="checkbox" data-field="confirmationDad" ${tx.confirmationDad ? "checked" : ""}></td>
      <td>${tx.notes || ""}</td>
      <td>
        <button class="edit-btn">Edit</button>
        <button class="delete-btn secondary">Delete</button>
      </td>
    `;

    const checkboxTaylor = tr.querySelector('input[data-field="confirmationTaylor"]');
    const checkboxDad = tr.querySelector('input[data-field="confirmationDad"]');
    if (state.user.role === "dad") checkboxTaylor.disabled = true;
    if (state.user.role === "taylor") checkboxDad.disabled = true;

    checkboxTaylor?.addEventListener("change", () => updateCheckbox(tx._id, "confirmationTaylor", checkboxTaylor.checked, checkboxTaylor));
    checkboxDad?.addEventListener("change", () => updateCheckbox(tx._id, "confirmationDad", checkboxDad.checked, checkboxDad));
    tr.querySelector(".edit-btn").addEventListener("click", () => editTransaction(tx));
    tr.querySelector(".delete-btn").addEventListener("click", () => deleteTransaction(tx._id));

    addDragHandlers(tr);
    els.transactionsBody.appendChild(tr);
  });
}

// Convert DD/MM/YYYY (backend format) to YYYY-MM-DD (HTML5 date input format)
function dateToInputFormat(dateStr) {
  if (!dateStr) return "";
  // Handle both Date objects and date strings
  const d = dateStr instanceof Date ? dateStr : new Date(dateStr);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// Convert YYYY-MM-DD (HTML5 date input format) to DD/MM/YYYY (backend format)
function inputFormatToDate(inputDateStr) {
  if (!inputDateStr) return "";
  const [yyyy, mm, dd] = inputDateStr.split("-");
  return `${dd}/${mm}/${yyyy}`;
}

// Format date for display (DD/MM/YYYY)
function formatDate(dateStr) {
  const d = new Date(dateStr);
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

// Get today's date in YYYY-MM-DD format for date inputs
function getTodayDateInput() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// Get today's date in DD/MM/YYYY format (backend format)
function getTodayDateBackend() {
  const today = new Date();
  const dd = String(today.getDate()).padStart(2, "0");
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const yyyy = today.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

async function updateCheckbox(id, field, value, checkboxEl) {
  try {
    await apiFetch(`/transactions/${id}/checkbox`, {
      method: "PATCH",
      body: JSON.stringify({ field, value })
    });
  } catch (err) {
    checkboxEl.checked = !value;
    showTableError(err.message);
  }
}

async function editTransaction(tx) {
  const date = prompt("Date DD/MM/YYYY", formatDate(tx.date));
  if (!date) return;
  const type = prompt("Type", tx.transactionType);
  if (!type) return;
  let amount = Number(prompt("Amount (signed number)", tx.amount));
  if (Number.isNaN(amount)) return;
  
  // Convert deposit amounts to negative if positive
  if (type === "Deposit" && amount > 0) {
    amount = -amount;
  }
  
  const notes = prompt("Notes", tx.notes || "") || "";
  try {
    await apiFetch(`/transactions/${tx._id}`, {
      method: "PUT",
      body: JSON.stringify({ date, transactionType: type, amount, notes })
    });
    await loadTransactions();
  } catch (err) {
    showTableError(err.message);
  }
}

async function deleteTransaction(id) {
  if (!confirm("Delete transaction? This cannot be undone.")) return;
  try {
    await apiFetch(`/transactions/${id}`, { method: "DELETE" });
    await loadTransactions();
  } catch (err) {
    showTableError(err.message);
  }
}

function addDragHandlers(row) {
  row.addEventListener("dragstart", (e) => {
    row.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
  });
  row.addEventListener("dragend", () => {
    row.classList.remove("dragging");
    handleDrop();
  });
  row.addEventListener("dragover", (e) => {
    e.preventDefault();
    const dragging = document.querySelector("tr.dragging");
    if (!dragging || dragging === row) return;
    const rows = Array.from(els.transactionsBody.children);
    const draggingIndex = rows.indexOf(dragging);
    const targetIndex = rows.indexOf(row);
    if (draggingIndex < targetIndex) {
      els.transactionsBody.insertBefore(dragging, row.nextSibling);
    } else {
      els.transactionsBody.insertBefore(dragging, row);
    }
  });
}

async function handleDrop() {
  // Check if filters are active - if so, disable reordering
  const hasFilters = els.filterType.value || els.filterStart.value || els.filterEnd.value;
  if (hasFilters) {
    showTableError("Cannot reorder transactions when filters are active. Please clear filters first.");
    // Reload to reset the order
    await loadTransactions();
    return;
  }
  
  const rows = Array.from(els.transactionsBody.children);
  const orderedIds = rows.map((r) => r.dataset.id);
  const expectedOrder = state.transactions.map((t) => t._id);
  
  try {
    await apiFetch("/transactions/reorder", {
      method: "PATCH",
      body: JSON.stringify({ expectedOrder, orderedIds })
    });
    
    // Update state.transactions to match new order
    const transactionMap = new Map(state.transactions.map(t => [t._id, t]));
    state.transactions = orderedIds.map(id => transactionMap.get(id)).filter(Boolean);
    
    // Recalculate and update running totals
    updateRunningTotals();
  } catch (err) {
    // On conflict, refresh from server
    await loadTransactions();
    showTableError(err.message);
  }
}

function updateRunningTotals() {
  const totals = computeRunningTotals(state.transactions);
  const rows = Array.from(els.transactionsBody.children);
  rows.forEach((row, idx) => {
    const totalCell = row.querySelector("td:nth-child(5)"); // 5th column is running total
    if (totalCell) {
      totalCell.textContent = totals[idx];
    }
  });
}

function showTableError(msg) {
  els.tableError.textContent = msg;
  setTimeout(() => {
    els.tableError.textContent = "";
  }, 5000);
}

function attachEvents() {
  els.loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = new FormData(els.loginForm);
    try {
      await login(form.get("email"), form.get("password"));
    } catch (err) {
      els.authError.textContent = err.message;
    }
  });

  els.logoutBtn.addEventListener("click", async () => {
    await logout();
  });

  els.transactionForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = new FormData(els.transactionForm);
    const dateInput = form.get("date");
    const transactionType = form.get("transactionType");
    let amount = Number(form.get("amount"));
    
    // Convert deposit amounts to negative
    if (transactionType === "Deposit" && amount > 0) {
      amount = -amount;
    }
    
    const payload = {
      date: inputFormatToDate(dateInput), // Convert from YYYY-MM-DD to DD/MM/YYYY
      transactionType,
      amount,
      notes: form.get("notes")
    };
    try {
      await apiFetch("/transactions", { method: "POST", body: JSON.stringify(payload) });
      els.transactionForm.reset();
      // Set date back to today after reset
      els.transactionForm.querySelector('input[name="date"]').value = getTodayDateInput();
      await loadTransactions();
    } catch (err) {
      showTableError(err.message);
    }
  });

  els.applyFilters.addEventListener("click", async () => {
    try {
      await loadTransactions();
    } catch (err) {
      showTableError(err.message);
    }
  });

  els.quickButtons.forEach((btn) => {
    btn.addEventListener("click", async () => {
      const amount = Number(btn.dataset.amount);
      
      // Determine truck type from parent section heading
      const quickAddSection = btn.closest(".quick-add");
      const heading = quickAddSection?.querySelector("h3")?.textContent || "";
      let transactionType = "Concord Truck"; // default
      
      if (heading.includes("Durham Truck")) {
        transactionType = "Durham Truck";
      } else if (heading.includes("Concord Truck")) {
        transactionType = "Concord Truck";
      }
      
      const payload = {
        date: getTodayDateBackend(), // Use today's date in DD/MM/YYYY format
        transactionType,
        amount,
        notes: btn.textContent
      };
      try {
        await apiFetch("/transactions", { method: "POST", body: JSON.stringify(payload) });
        await loadTransactions();
      } catch (err) {
        showTableError(err.message);
      }
    });
  });
  
}

function initializeDateInputs() {
  // Set default date to today for transaction form
  const transactionDateInput = els.transactionForm.querySelector('input[name="date"]');
  if (transactionDateInput) {
    transactionDateInput.value = getTodayDateInput();
  }
}

async function init() {
  // Initialize date inputs with today's date
  initializeDateInputs();
  
  // Try to restore session from existing cookie
  try {
    const data = await apiFetch("/auth/me", { method: "GET" });
    if (data.user && data.csrfToken) {
      state.user = data.user;
      state.csrfToken = data.csrfToken;
      setAuthUI(true);
      await loadTransactions();
    }
  } catch (err) {
    // Not logged in, that's fine
    setAuthUI(false);
  }
}

attachEvents();
init();

