const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'almaarif_secret_jwt_key_2026';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

// Auth Middleware for Admin routes
function authAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'غير مصرح: يرجى تسجيل الدخول كمدير' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'غير مصرح: صلاحيات مدير فقط' });
    }
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'جلسة عمل غير صالحة أو منتهية' });
  }
}

// ------------------------------------------------------------------
// AUTH ROUTES
// ------------------------------------------------------------------

// Admin Login
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'يرجى إدخال اسم المستخدم وكلمة المرور' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) {
    return res.status(401).json({ success: false, message: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
  }

  const passwordValid = bcrypt.compareSync(password, user.password_hash);
  if (!passwordValid) {
    return res.status(401).json({ success: false, message: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, full_name: user.full_name, role: user.role },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  return res.json({
    success: true,
    message: 'تم تسجيل الدخول بنجاح',
    token,
    user: {
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      role: user.role
    }
  });
});

// Verify Auth Token
app.get('/api/auth/me', authAdmin, (req, res) => {
  res.json({ success: true, user: req.user });
});

// ------------------------------------------------------------------
// DEPARTMENT & GRADE AVERAGE ROUTES
// ------------------------------------------------------------------

// Get All Departments (Public)
app.get('/api/departments', (req, res) => {
  try {
    const category = req.query.category;
    let query = 'SELECT * FROM departments ORDER BY category ASC, morning_avg DESC';
    let depts;
    if (category && category !== 'all') {
      depts = db.prepare('SELECT * FROM departments WHERE category = ? ORDER BY morning_avg DESC').all(category);
    } else {
      depts = db.prepare(query).all();
    }
    res.json({ success: true, data: depts });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get Single Department (Public)
app.get('/api/departments/:id', (req, res) => {
  try {
    const dept = db.prepare('SELECT * FROM departments WHERE id = ?').get(req.params.id);
    if (!dept) return res.status(404).json({ success: false, message: 'القسم غير موجود' });
    res.json({ success: true, data: dept });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Add New College / Department (Admin Only)
app.post('/api/departments', authAdmin, (req, res) => {
  try {
    const {
      college_name_ar, college_name_en,
      dept_name_ar, dept_name_en,
      category, morning_avg, evening_avg,
      tuition_fee, image_url, icon_class,
      description_ar, description_en
    } = req.body;

    if (!dept_name_ar || !college_name_ar || !category) {
      return res.status(400).json({ success: false, message: 'جميع الحقول الأساسية مطلوبة' });
    }

    const dept_key = 'dept_' + Date.now();

    const stmt = db.prepare(`
      INSERT INTO departments (
        dept_key, college_name_ar, college_name_en, dept_name_ar, dept_name_en,
        category, morning_avg, evening_avg, tuition_fee, image_url, icon_class,
        description_ar, description_en
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      dept_key,
      college_name_ar,
      college_name_en || college_name_ar,
      dept_name_ar,
      dept_name_en || dept_name_ar,
      category,
      parseFloat(morning_avg) || 50.0,
      parseFloat(evening_avg) || 50.0,
      parseInt(tuition_fee) || 1500000,
      image_url || 'assets/images/hero.webp',
      icon_class || 'fa-graduation-cap',
      description_ar || '',
      description_en || ''
    );

    const newDept = db.prepare('SELECT * FROM departments WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ success: true, message: 'تم إضافة الكلية / القسم بنجاح', data: newDept });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Update Department details / Increase or Decrease Grade Cutoffs (Admin Only)
app.put('/api/departments/:id', authAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM departments WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'القسم غير موجود' });
    }

    const {
      college_name_ar, college_name_en,
      dept_name_ar, dept_name_en,
      category, morning_avg, evening_avg,
      tuition_fee, image_url, icon_class,
      description_ar, description_en
    } = req.body;

    const stmt = db.prepare(`
      UPDATE departments SET
        college_name_ar = ?,
        college_name_en = ?,
        dept_name_ar = ?,
        dept_name_en = ?,
        category = ?,
        morning_avg = ?,
        evening_avg = ?,
        tuition_fee = ?,
        image_url = ?,
        icon_class = ?,
        description_ar = ?,
        description_en = ?
      WHERE id = ?
    `);

    stmt.run(
      college_name_ar !== undefined ? college_name_ar : existing.college_name_ar,
      college_name_en !== undefined ? college_name_en : existing.college_name_en,
      dept_name_ar !== undefined ? dept_name_ar : existing.dept_name_ar,
      dept_name_en !== undefined ? dept_name_en : existing.dept_name_en,
      category !== undefined ? category : existing.category,
      morning_avg !== undefined ? parseFloat(morning_avg) : existing.morning_avg,
      evening_avg !== undefined ? parseFloat(evening_avg) : existing.evening_avg,
      tuition_fee !== undefined ? parseInt(tuition_fee) : existing.tuition_fee,
      image_url !== undefined ? image_url : existing.image_url,
      icon_class !== undefined ? icon_class : existing.icon_class,
      description_ar !== undefined ? description_ar : existing.description_ar,
      description_en !== undefined ? description_en : existing.description_en,
      id
    );

    const updated = db.prepare('SELECT * FROM departments WHERE id = ?').get(id);
    res.json({ success: true, message: 'تم تحديث البيانات والمعدل بنجاح', data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Delete College / Department (Admin Only)
app.delete('/api/departments/:id', authAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const stmt = db.prepare('DELETE FROM departments WHERE id = ?');
    const result = stmt.run(id);
    if (result.changes === 0) {
      return res.status(404).json({ success: false, message: 'القسم غير موجود' });
    }
    res.json({ success: true, message: 'تم حذف الكلية / القسم بنجاح' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ------------------------------------------------------------------
// STUDENT REGISTRATION ROUTES
// ------------------------------------------------------------------

// Submit Student Application (Public)
app.post('/api/registrations', (req, res) => {
  try {
    const {
      student_name, phone, email, city,
      study_branch, high_school_avg, dept_id,
      dept_name, study_type, notes
    } = req.body;

    if (!student_name || !phone || !email || !high_school_avg) {
      return res.status(400).json({ success: false, message: 'يرجى ملء جميع الحقول المطلوبة' });
    }

    const stmt = db.prepare(`
      INSERT INTO student_registrations (
        student_name, phone, email, city,
        study_branch, high_school_avg, dept_id,
        dept_name, study_type, notes, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `);

    const result = stmt.run(
      student_name,
      phone,
      email,
      city || '',
      study_branch || '',
      parseFloat(high_school_avg),
      dept_id ? parseInt(dept_id) : null,
      dept_name || 'غير محدد',
      study_type || 'صباحي',
      notes || ''
    );

    res.status(201).json({
      success: true,
      message: 'تم إرسال استمارة التسجيل بنجاح! سيتم التواصل معك قريباً',
      registration_id: result.lastInsertRowid
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get All Student Registrations with Filter & Search (Admin Only)
app.get('/api/registrations', authAdmin, (req, res) => {
  try {
    const { status, search } = req.query;
    let query = 'SELECT * FROM student_registrations';
    const params = [];
    const conditions = [];

    if (status && status !== 'all') {
      conditions.push('status = ?');
      params.push(status);
    }

    if (search) {
      conditions.push('(student_name LIKE ? OR phone LIKE ? OR email LIKE ? OR dept_name LIKE ?)');
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam, searchParam);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY created_at DESC';

    const registrations = db.prepare(query).all(...params);
    res.json({ success: true, count: registrations.length, data: registrations });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Update Student Registration Status (Admin Only)
app.patch('/api/registrations/:id/status', authAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['pending', 'accepted', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'حالة التسجيل غير صالحة' });
    }

    const stmt = db.prepare('UPDATE student_registrations SET status = ? WHERE id = ?');
    const result = stmt.run(status, id);

    if (result.changes === 0) {
      return res.status(404).json({ success: false, message: 'طلب التسجيل غير موجود' });
    }

    res.json({ success: true, message: 'تم تحديث حالة طلب الطالب بنجاح' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Delete Student Registration (Admin Only)
app.delete('/api/registrations/:id', authAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const stmt = db.prepare('DELETE FROM student_registrations WHERE id = ?');
    const result = stmt.run(id);

    if (result.changes === 0) {
      return res.status(404).json({ success: false, message: 'طلب التسجيل غير موجود' });
    }

    res.json({ success: true, message: 'تم حذف طلب التسجيل بنجاح' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ------------------------------------------------------------------
// DASHBOARD STATS ROUTE
// ------------------------------------------------------------------

// Summary Counts (Admin Only)
app.get('/api/stats', authAdmin, (req, res) => {
  try {
    const totalStudents = db.prepare('SELECT count(*) as count FROM student_registrations').get().count;
    const pendingCount = db.prepare("SELECT count(*) as count FROM student_registrations WHERE status = 'pending'").get().count;
    const acceptedCount = db.prepare("SELECT count(*) as count FROM student_registrations WHERE status = 'accepted'").get().count;
    const rejectedCount = db.prepare("SELECT count(*) as count FROM student_registrations WHERE status = 'rejected'").get().count;
    const totalDepartments = db.prepare('SELECT count(*) as count FROM departments').get().count;

    res.json({
      success: true,
      data: {
        totalStudents,
        pendingCount,
        acceptedCount,
        rejectedCount,
        totalDepartments
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Fallback to index.html for undefined routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 Al-Maarif University Server running on http://localhost:${PORT}`);
  console.log(`🔑 Admin Dashboard available at http://localhost:${PORT}/admin.html`);
  console.log(`====================================================`);
});
