const express = require('express');
const path = require('path');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');

// MySQL connection pool
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'Password@123',
  database: 'companydb',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

const app = express();
const PORT = 3000;

// Middleware to parse JSON and urlencoded data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (like index.html, CSS, JS)
app.use(express.static(path.join(__dirname)));

// Example API endpoint (departments)
app.get('/api/departments', (req, res) => {
  pool.query('SELECT * FROM departments', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// Get all departments with employee count
app.get('/api/departments-with-count', (req, res) => {
  const sql = `
    SELECT d.department_id, d.department_name, d.location, 
           COUNT(e.employee_id) AS num_employees
    FROM departments d
    LEFT JOIN employees e ON d.department_id = e.department_id
    GROUP BY d.department_id, d.department_name, d.location
    ORDER BY d.department_id
  `;
  pool.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// API endpoint to register a new manager
app.post('/api/registermanager', async (req, res) => {
  try {
    const { fullname, email, password, department_id } = req.body;
    console.log('Received registration request:', { fullname, email, department_id }); // Debug log

    // Input validation
    if (!fullname || !email || !password || !department_id) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check for existing email
    const [existingEmail] = await pool.promise().query(
      'SELECT email FROM user_credentials WHERE email = ?',
      [email]
    );

    if (existingEmail.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Generate manager_id
    const [rows] = await pool.promise().query(
      "SELECT MAX(CAST(SUBSTRING(manager_id, 3) AS UNSIGNED)) AS max_id FROM managers"
    );
    let managerNum = 1;
    if (rows.length > 0 && rows[0].max_id !== null) {
      managerNum = rows[0].max_id + 1;
    }
    const managerId = `MG${managerNum}`;

    // Start transaction
    const connection = await pool.promise().getConnection();
    await connection.beginTransaction();

    try {
      const names = fullname.split(' ');
      const firstName = names[0];
      const lastName = names.slice(1).join(' ');
      const hashedPassword = await bcrypt.hash(password, 10);

      // Insert into managers table
      await connection.query(
        `INSERT INTO managers (manager_id, first_name, last_name, email, department_id, hire_date, status) 
         VALUES (?, ?, ?, ?, ?, CURDATE(), 'active')`,
        [managerId, firstName, lastName, email, department_id]
      );

      // Insert into user_credentials
      await connection.query(
        `INSERT INTO user_credentials (user_id, email, password, role) 
         VALUES (?, ?, ?, 'manager')`,
        [managerId, email, hashedPassword]
      );

      await connection.commit();
      connection.release();
      
      console.log('Registration successful for manager:', managerId); // Debug log
      res.json({ success: true, message: 'Registration successful!' });
    } catch (error) {
      await connection.rollback();
      connection.release();
      console.error('Database error:', error); // Debug log
      res.status(500).json({ error: 'Registration failed. Please try again.' });
    }
  } catch (error) {
    console.error('Server error:', error); // Debug log
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

// API endpoint to register a new employee
app.post('/api/registeremployee', (req, res) => {
  const { fullname, email, password, department_id, date_of_birth, hire_date, phone_number, position, status } = req.body;
  const names = fullname.trim().split(' ');
  const first_name = names[0];
  const last_name = names.slice(1).join(' ') || '';

  // Generate a new employee_id (e.g., EM11, EM12, ...)
  pool.query('SELECT employee_id FROM employees ORDER BY employee_id DESC LIMIT 1', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });

    let newIdNum = 1;
    if (results.length > 0) {
      const lastId = results[0].employee_id;
      const num = parseInt(lastId.replace(/\D/g, ''), 10);
      newIdNum = num + 1;
    }
    const employee_id = `EM${newIdNum}`;

    // 1. Insert into employees table first
    pool.query(
      `INSERT INTO employees (employee_id, first_name, last_name, date_of_birth, hire_date, email, phone_number, department_id, position, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [employee_id, first_name, last_name, date_of_birth, hire_date, email, phone_number, department_id, position, status],
      (err) => {
        if (err) return res.status(500).json({ error: err.message });

        // 2. Then insert into user_credentials
        bcrypt.hash(password, 10, (hashErr, hashedPassword) => {
          if (hashErr) return res.status(500).json({ error: hashErr.message });

          pool.query(
            `INSERT INTO user_credentials (user_id, email, password, role) VALUES (?, ?, ?, 'employee')`,
            [employee_id, email, hashedPassword],
            (err2) => {
              if (err2) return res.status(500).json({ error: err2.message });
              res.json({ success: true, message: 'Employee registered successfully!' });
            }
          );
        });
      }
    );
  });
});

// Login endpoint for both managers and employees
app.post('/api/login', async (req, res) => {
  const { email, password, role } = req.body;

  try {
    if (role === 'employee') {
      // 1. Check if employee exists in employee_credentials (normal login)
      const [empCred] = await pool.promise().query(
        'SELECT * FROM employee_credentials WHERE email = ?',
        [email]
      );
      if (empCred.length > 0) {
        // Employee credential exists, check password
        const isMatch = await bcrypt.compare(password, empCred[0].password);
        if (!isMatch) {
          return res.status(401).json({ success: false, error: 'Enter valid credentials' });
        }
        // Success: normal employee login
        return res.json({ 
          success: true, 
          user_id: empCred[0].user_id, 
          role: 'employee'
        });
      }

      // 2. If not in employee_credentials, check if email exists in employees (first login)
      const [emp] = await pool.promise().query(
        'SELECT * FROM employees WHERE email = ?',
        [email]
      );
      if (emp.length === 0) {
        return res.status(401).json({ success: false, error: 'You are not registered as an employee.' });
      }

      // First login: set password as permanent
      const hashedPassword = await bcrypt.hash(password, 10);
      await pool.promise().query(
        'INSERT INTO employee_credentials (user_id, email, password, role) VALUES (?, ?, ?, ?)',
        [emp[0].employee_id, email, hashedPassword, 'employee']
      );

      return res.json({ 
        success: true, 
        user_id: emp[0].employee_id, 
        role: 'employee',
        message: 'Password set successfully. You are now logged in.'
      });
    }

    // Manager login (unchanged)
    const [users] = await pool.promise().query(
      'SELECT * FROM user_credentials WHERE email = ? AND role = ?',
      [email, role]
    );
    if (users.length === 0) {
      return res.status(401).json({ success: false, error: 'Enter valid credentials' });
    }
    const isMatch = await bcrypt.compare(password, users[0].password);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Enter valid credentials' });
    }
    if (role === 'manager') {
      const [managerInfo] = await pool.promise().query(
        'SELECT department_id FROM managers WHERE manager_id = ?',
        [users[0].user_id]
      );
      if (managerInfo.length > 0) {
        return res.json({ 
          success: true, 
          user_id: users[0].user_id, 
          role: users[0].role,
          department_id: managerInfo[0].department_id
        });
      }
    }
    res.json({ success: true, user_id: users[0].user_id, role: users[0].role });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Default route to serve index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Add Employee API (for addem.html)
app.post('/api/addemployee', async (req, res) => {
  try {
    const { 
      first_name, 
      last_name, 
      date_of_birth, 
      phone_number, 
      email, 
      salary,
      department_id
    } = req.body;

    // Validate department_id
    if (!department_id) {
      return res.status(400).json({ error: "Department ID is required" });
    }

    // Server-side validation for alphabets
    const alphaRegex = /^[A-Za-z\s]+$/;
    if (!alphaRegex.test(first_name) || !alphaRegex.test(last_name)) {
      return res.status(400).json({ error: "First Name and Last Name should contain only alphabets and spaces." });
    }

    // Verify department exists
    const [deptCheck] = await pool.promise().query(
      'SELECT department_id FROM departments WHERE department_id = ?',
      [department_id]
    );

    if (deptCheck.length === 0) {
      return res.status(400).json({ error: "Invalid department ID" });
    }

    // Generate new employee_id (find max numeric part)
    const [rows] = await pool.promise().query(
      "SELECT MAX(CAST(SUBSTRING(employee_id, 3) AS UNSIGNED)) AS max_id FROM employees"
    );
    let empNum = 1;
    if (rows.length > 0 && rows[0].max_id !== null) {
      empNum = rows[0].max_id + 1;
    }
    const employee_id = `EM${empNum}`;

    // Insert into employees table with position as 'employee'
    await pool.promise().query(
      `INSERT INTO employees (
        employee_id, first_name, last_name, date_of_birth, 
        hire_date, email, phone_number, department_id, 
        position, status
      ) VALUES (?, ?, ?, ?, CURDATE(), ?, ?, ?, ?, 'active')`,
      [
        employee_id,
        first_name,
        last_name,
        date_of_birth,
        email,
        phone_number,
        department_id,
        'employee' // <-- Always set position as 'employee'
      ]
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get employees by department_id (with department name)
app.get('/api/employees/by-department/:department_id', (req, res) => {
  const { department_id } = req.params;
  const sql = `
    SELECT e.first_name, e.last_name, e.date_of_birth, e.hire_date, e.email, e.phone_number, d.department_name
    FROM employees e
    JOIN departments d ON e.department_id = d.department_id
    WHERE e.department_id = ?
    ORDER BY e.first_name, e.last_name
  `;
  pool.query(sql, [department_id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// Get individual employee details by employee_id
app.get('/api/employee/:employee_id', (req, res) => {
  const { employee_id } = req.params;
  const sql = `
    SELECT e.*, d.department_name 
    FROM employees e
    JOIN departments d ON e.department_id = d.department_id
    WHERE e.employee_id = ?
    LIMIT 1
  `;
  pool.query(sql, [employee_id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results[0] || {});
  });
});

// Mark Time In
app.post('/api/attendance/timein', async (req, res) => {
  const { employee_id } = req.body;
  if (!employee_id) return res.status(400).json({ error: "Employee ID required" });

  // Check if already marked in today
  const [existing] = await pool.promise().query(
    "SELECT * FROM attendance WHERE employee_id = ? AND date = CURDATE()",
    [employee_id]
  );
  if (existing.length > 0) {
    return res.status(400).json({ error: "Already marked Time In for today" });
  }

  // Generate attendance_id
  const [rows] = await pool.promise().query(
    "SELECT MAX(CAST(SUBSTRING(attendance_id, 3) AS UNSIGNED)) AS max_id FROM attendance"
  );
  let attNum = 1;
  if (rows.length > 0 && rows[0].max_id !== null) {
    attNum = rows[0].max_id + 1;
  }
  const attendance_id = `AT${attNum}`;

  // Insert into attendance table
  await pool.promise().query(
    "INSERT INTO attendance (attendance_id, employee_id, date, check_in, status) VALUES (?, ?, CURDATE(), CURTIME(), 'present')",
    [attendance_id, employee_id]
  );
  res.json({ success: true });
});

// Mark Time Out
app.post('/api/attendance/timeout', async (req, res) => {
  const { employee_id } = req.body;
  if (!employee_id) return res.status(400).json({ error: "Employee ID required" });

  // Validate employee exists
  const [emp] = await pool.promise().query(
    "SELECT * FROM employees WHERE employee_id = ?",
    [employee_id]
  );
  if (emp.length === 0) {
    return res.status(400).json({ error: "Invalid employee ID" });
  }

  // Find today's attendance
  const [rows] = await pool.promise().query(
    "SELECT * FROM attendance WHERE employee_id = ? AND date = CURDATE()",
    [employee_id]
  );
  if (rows.length === 0) {
    return res.status(400).json({ error: "No Time In record for today" });
  }
  if (rows[0].check_out) {
    return res.status(400).json({ error: "Already marked Time Out for today" });
  }

  // Calculate hours worked
  const checkIn = rows[0].check_in; // "HH:MM:SS"
  const now = new Date();
  const [h, m, s] = checkIn.split(':').map(Number);
  const checkInDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, s);
  let hoursWorked = (now - checkInDate) / (1000 * 60 * 60);
  if (hoursWorked < 0) hoursWorked += 24;
  hoursWorked = Math.round(hoursWorked * 100) / 100;

  // Update attendance table
  await pool.promise().query(
    "UPDATE attendance SET check_out = CURTIME(), hours_worked = ? WHERE attendance_id = ?",
    [hoursWorked, rows[0].attendance_id]
  );
  res.json({ success: true });
});

// Get today's attendance for employee
app.get('/api/attendance/today/:employee_id', async (req, res) => {
  const { employee_id } = req.params;
  const [rows] = await pool.promise().query(
    "SELECT * FROM attendance WHERE employee_id = ? AND date = CURDATE()",
    [employee_id]
  );
  res.json(rows[0] || {});
});

// Get all attendance records
app.get('/api/attendance/all', async (req, res) => {
  const [rows] = await pool.promise().query(
    "SELECT attendance_id, employee_id, status, date, hours_worked FROM attendance ORDER BY date DESC"
  );
  res.json(rows);
});

// Get salary history for an employee
app.get('/api/salaryhistory/:employee_id', async (req, res) => {
  const { employee_id } = req.params;
  const [rows] = await pool.promise().query(
    "SELECT * FROM salary_history WHERE employee_id = ? ORDER BY effective_date DESC",
    [employee_id]
  );
  res.json(rows);
});

// Get salary history for employees
app.get('/api/salaryhistory', async (req, res) => {
  try {
    const [rows] = await pool.promise().query(`
      SELECT
        history_id,
        employee_id,
        month,
        salary,
        status
      FROM salary_history
      ORDER BY month DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add salary history entry
app.post('/api/salaryhistory', async (req, res) => {
  const { employee_id, old_salary, new_salary, total_pay, effective_date } = req.body;
  try {
    // Generate new history_id
    const [rows] = await pool.promise().query(
      "SELECT MAX(CAST(SUBSTRING(history_id, 3) AS UNSIGNED)) AS max_id FROM salary_history"
    );
    let histNum = 1;
    if (rows.length > 0 && rows[0].max_id !== null) {
      histNum = rows[0].max_id + 1;
    }
    const history_id = `SH${histNum}`;
    await pool.promise().query(
      "INSERT INTO salary_history (history_id, employee_id, old_salary, new_salary, total_pay, effective_date) VALUES (?, ?, ?, ?, ?, ?)",
      [history_id, employee_id, old_salary, new_salary, total_pay, effective_date]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all salary payments
app.get('/api/salarypayments', async (req, res) => {
  const [rows] = await pool.promise().query(
    "SELECT salary_id, employee_id, salary_amount, paid_amount, status FROM salary_payments ORDER BY salary_id DESC"
  );
  res.json(rows);
});

// Add a salary payment
app.post('/api/salarypayments', async (req, res) => {
  const { salary_id, employee_id, salary_amount, paid_amount, status } = req.body;
  try {
    await pool.promise().query(
      "INSERT INTO salary_payments (salary_id, employee_id, salary_amount, paid_amount, status) VALUES (?, ?, ?, ?, ?)",
      [salary_id, employee_id, salary_amount, paid_amount, status]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all deductions
app.get('/api/deductions', async (req, res) => {
  const [rows] = await pool.promise().query(
    "SELECT deduction_id, employee_id, deduction_type, amount, deduction_date FROM deductions ORDER BY deduction_date DESC"
  );
  res.json(rows);
});

// Add a deduction
app.post('/api/deductions', async (req, res) => {
  const { deduction_id, employee_id, deduction_type, amount, deduction_date } = req.body;
  try {
    await pool.promise().query(
      "INSERT INTO deductions (deduction_id, employee_id, deduction_type, amount, deduction_date) VALUES (?, ?, ?, ?, ?)",
      [deduction_id, employee_id, deduction_type, amount, deduction_date]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all benefits
app.get('/api/benefits', async (req, res) => {
  const [rows] = await pool.promise().query(
    "SELECT benefit_id, employee_id, salary_id, benefit_type, benefit_amount, effective_date FROM benefits ORDER BY effective_date DESC"
  );
  res.json(rows);
});

// Add a benefit
app.post('/api/benefits', async (req, res) => {
  const { benefit_id, employee_id, salary_id, benefit_type, benefit_amount, effective_date } = req.body;
  try {
    await pool.promise().query(
      "INSERT INTO benefits (benefit_id, employee_id, salary_id, benefit_type, benefit_amount, effective_date) VALUES (?, ?, ?, ?, ?, ?)",
      [benefit_id, employee_id, salary_id, benefit_type, benefit_amount, effective_date]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get total payment info for each employee
app.get('/api/totalpayments', async (req, res) => {
  try {
    const [rows] = await pool.promise().query(`
      SELECT
        sp.salary_id AS payment_id,
        sp.employee_id,
        sp.salary_amount AS salary,
        IFNULL(SUM(b.benefit_amount), 0) AS benefits,
        IFNULL(SUM(d.amount), 0) AS deductions,
        (sp.salary_amount + IFNULL(SUM(b.benefit_amount), 0) - IFNULL(SUM(d.amount), 0)) AS net_salary
      FROM salary_payments sp
      LEFT JOIN benefits b ON sp.salary_id = b.salary_id
      LEFT JOIN deductions d ON sp.employee_id = d.employee_id
      GROUP BY sp.salary_id, sp.employee_id, sp.salary_amount
      ORDER BY sp.salary_id DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get total payment info for a specific employee
app.get('/api/totalpayments/:employee_id', async (req, res) => {
  const { employee_id } = req.params;
  try {
    const [rows] = await pool.promise().query(`
      SELECT
        sp.salary_id AS payment_id,
        sp.employee_id,
        sp.salary_amount AS salary,
        IFNULL(SUM(b.benefit_amount), 0) AS benefits,
        IFNULL(SUM(d.amount), 0) AS deductions,
        (sp.salary_amount + IFNULL(SUM(b.benefit_amount), 0) - IFNULL(SUM(d.amount), 0)) AS net_salary
      FROM salary_payments sp
      LEFT JOIN benefits b ON sp.salary_id = b.salary_id
      LEFT JOIN deductions d ON sp.employee_id = d.employee_id
      WHERE sp.employee_id = ?
      GROUP BY sp.salary_id, sp.employee_id, sp.salary_amount
      ORDER BY sp.salary_id DESC
    `, [employee_id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});