const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initDB() {
  console.log('Initializing SQLite Database...');

  // 1. Users table (Admin & Staff)
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 2. Departments table
  db.exec(`
    CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dept_key TEXT UNIQUE NOT NULL,
      college_name_ar TEXT NOT NULL,
      college_name_en TEXT NOT NULL,
      dept_name_ar TEXT NOT NULL,
      dept_name_en TEXT NOT NULL,
      category TEXT NOT NULL CHECK(category IN ('medical', 'engineering', 'humanities')),
      morning_avg REAL NOT NULL DEFAULT 50.0,
      evening_avg REAL NOT NULL DEFAULT 50.0,
      tuition_fee INTEGER NOT NULL DEFAULT 1500000,
      image_url TEXT NOT NULL DEFAULT 'assets/images/hero.webp',
      icon_class TEXT NOT NULL DEFAULT 'fa-university',
      description_ar TEXT,
      description_en TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 3. Student Registrations table
  db.exec(`
    CREATE TABLE IF NOT EXISTS student_registrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT NOT NULL,
      city TEXT NOT NULL,
      study_branch TEXT NOT NULL,
      high_school_avg REAL NOT NULL,
      dept_id INTEGER,
      dept_name TEXT NOT NULL,
      study_type TEXT NOT NULL,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'rejected')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(dept_id) REFERENCES departments(id) ON DELETE SET NULL
    );
  `);

  // Seed Default Admin Account if missing
  const adminCheck = db.prepare('SELECT count(*) as count FROM users WHERE username = ?').get('admin');
  if (adminCheck.count === 0) {
    const defaultPasswordHash = bcrypt.hashSync('admin123', 10);
    db.prepare(`
      INSERT INTO users (username, password_hash, full_name, role)
      VALUES (?, ?, ?, ?)
    `).run('admin', defaultPasswordHash, 'المدير العام', 'admin');
    console.log('✅ Created default admin account (username: admin, pass: admin123)');
  }

  // Seed Initial Departments if table empty
  const deptCheck = db.prepare('SELECT count(*) as count FROM departments').get();
  if (deptCheck.count === 0) {
    const insertDept = db.prepare(`
      INSERT INTO departments (
        dept_key, college_name_ar, college_name_en, dept_name_ar, dept_name_en,
        category, morning_avg, evening_avg, tuition_fee, image_url, icon_class,
        description_ar, description_en
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const defaultDepts = [
      [
        'dentistry', 'كلية طب الأسنان', 'College of Dentistry', 'كلية طب الأسنان', 'College of Dentistry',
        'medical', 84.5, 84.5, 9000000, 'assets/images/col_dentistry.webp', 'fa-tooth',
        'تُعدّ الكلية صرحاً علمياً في إعداد أطباء الأسنان المجهزين بأحدث المهارات السريرية.',
        'The college is a scientific landmark in preparing dentists equipped with the latest clinical skills.'
      ],
      [
        'pharmacy', 'كلية الصيدلة', 'College of Pharmacy', 'كلية الصيدلة', 'College of Pharmacy',
        'medical', 84.5, 84.5, 8500000, 'assets/images/col_pharmacy.webp', 'fa-pills',
        'تُخرّج صيادلة أكفاء مجهزين بأحدث المهارات العلمية والعملية للمساهمة في البحث العلمي والصناعات الدوائية.',
        'Graduates competent pharmacists equipped with the latest scientific and practical skills.'
      ],
      [
        'nursing', 'كلية التمريض', 'College of Nursing', 'كلية التمريض', 'College of Nursing',
        'medical', 69.5, 64.5, 3500000, 'assets/images/col_nursing.webp', 'fa-user-nurse',
        'تُعدّ كوادر تمريضية محترفة قادرة على تقديم الرعاية الصحية الشاملة.',
        'Prepares professional nursing staff capable of providing comprehensive health care.'
      ],
      [
        'med_tech', 'كلية التقنيات الصحية والطبية', 'Health & Medical Technologies', 'قسم تقنيات المختبرات الطبية', 'Medical Laboratory Tech',
        'medical', 69.5, 64.5, 3250000, 'assets/images/col_medlab.webp', 'fa-microscope',
        'تُخصّص لإعداد تقنيين في مجال المختبرات الطبية يمتلكون مهارات التشخيص الدقيق.',
        'Dedicated to preparing technicians in the field of medical laboratories with precise diagnostic skills.'
      ],
      [
        'civil_eng', 'كلية الهندسة', 'College of Engineering', 'قسم الهندسة المدنية', 'Civil Engineering Dept',
        'engineering', 62.5, 59.5, 2750000, 'assets/images/col_civil_eng.webp', 'fa-hard-hat',
        'يُؤهّل مهندسين مدنيين قادرين على تصميم وتنفيذ المشاريع الإنشائية الكبرى.',
        'Qualifies civil engineers capable of designing and implementing major construction projects.'
      ],
      [
        'cybersecurity', 'كلية التقنيات الهندسية', 'Engineering Technologies', 'قسم الأمن السيبراني', 'Cybersecurity Dept',
        'engineering', 59.5, 57.5, 2500000, 'assets/images/col_cybersecurity.webp', 'fa-shield-alt',
        'يُخرّج متخصصين في حماية الشبكات والأنظمة الرقمية ومكافحة الجرائم الإلكترونية.',
        'Graduates specialists in protecting networks and digital systems against cybercrimes.'
      ],
      [
        'ai_eng', 'كلية الهندسة', 'College of Engineering', 'قسم الذكاء الاصطناعي', 'Artificial Intelligence Dept',
        'engineering', 60.5, 58.0, 2600000, 'assets/images/col_ai.webp', 'fa-robot',
        'يُعدّ كوادر هندسية في مجالات تعلم الآلة ومعالجة اللغة الطبيعية والرؤية الحاسوبية.',
        'Prepares engineering cadres in machine learning, natural language processing, and computer vision.'
      ],
      [
        'law', 'كلية القانون', 'College of Law', 'قسم القانون', 'Department of Law',
        'humanities', 64.5, 60.5, 2250000, 'assets/images/col_law.webp', 'fa-balance-scale',
        'تُعدّ قانونيين وقضاة ملمّين بالقوانين المحلية والدولية.',
        'Prepares legal professionals and judges well-versed in local and international laws.'
      ],
      [
        'digital_media', 'كلية الإعلام', 'College of Media', 'قسم الإعلام الرقمي', 'Digital Media Dept',
        'humanities', 50.0, 50.0, 1800000, 'assets/images/col_media.webp', 'fa-broadcast-tower',
        'يُهيّئ إعلاميين رقميين متمكّنين من إنتاج المحتوى الاحترافي عبر المنصات الرقمية.',
        'Prepares digital media professionals capable of professional content production.'
      ],
      [
        'cs', 'كلية العلوم', 'College of Science', 'قسم علوم الحاسوب', 'Computer Science Dept',
        'engineering', 56.5, 54.5, 2000000, 'assets/images/col_cs.webp', 'fa-laptop-code',
        'يُؤهّل خرّيجين في برمجة التطبيقات وتطوير الأنظمة وقواعد البيانات.',
        'Qualifies graduates in application programming, systems development, and databases.'
      ],
      [
        'arabic_lang', 'كلية التربية', 'College of Education', 'قسم اللغة العربية', 'Arabic Language Dept',
        'humanities', 50.0, 50.0, 1500000, 'assets/images/col_arabic.webp', 'fa-feather-alt',
        'يُعنى بإعداد معلمين وأكاديميين متمكّنين من علوم اللغة العربية وآدابها.',
        'Aims to prepare teachers and academics proficient in Arabic language sciences and literature.'
      ],
      [
        'sports_science', 'كلية التربية وعلوم الرياضة', 'Physical Education', 'التربية البدنية وعلوم الرياضة', 'Sports Science Dept',
        'humanities', 50.0, 50.0, 1600000, 'assets/images/col_sports.webp', 'fa-running',
        'تُعدّ مدرّبين ومعلمي تربية رياضية وباحثين متخصصين في علوم الحركة.',
        'Prepares coaches, physical education teachers, and researchers in movement sciences.'
      ],
      [
        'english_lang', 'كلية التربية', 'College of Education', 'قسم اللغة الإنكليزية', 'English Language Dept',
        'humanities', 50.0, 50.0, 1750000, 'assets/images/col_english.webp', 'fa-language',
        'يُؤهّل كوادر تدريسية متمكّنة من اللغة الإنكليزية لغةً وأدبًا.',
        'Qualifies teaching staff proficient in English language and literature.'
      ],
      [
        'business_admin', 'كلية العلوم الإدارية والمالية', 'Admin & Financial Sciences', 'قسم إدارة الأعمال', 'Business Administration Dept',
        'humanities', 50.0, 50.0, 1850000, 'assets/images/col_business.webp', 'fa-briefcase',
        'تُنتج قادة أعمال وخبراء إداريين مؤهلين لإدارة المؤسسات والشركات.',
        'Produces business leaders and administrative experts qualified to manage institutions.'
      ],
      [
        'medical_devices', 'كلية التقنيات الهندسية', 'Engineering Technologies', 'قسم الأجهزة الطبية', 'Medical Devices Dept',
        'engineering', 59.5, 57.5, 2500000, 'assets/images/col_meddevice.webp', 'fa-heartbeat',
        'يُعدّ مهندسين متخصصين في تصميم وصيانة الأجهزة الطبية الحديثة.',
        'Prepares engineers specializing in the design and maintenance of modern medical devices.'
      ],
      [
        'comp_tech', 'كلية التقنيات الهندسية', 'Engineering Technologies', 'قسم تقنيات الحاسوب', 'Computer Tech Dept',
        'engineering', 59.5, 57.5, 2400000, 'assets/images/col_comptech.webp', 'fa-microchip',
        'يُؤهّل مهندسين في تصميم الأنظمة الحاسوبية والمدمجة والشبكات.',
        'Qualifies engineers in computer systems, embedded systems, and networks.'
      ]
    ];

    const insertTransaction = db.transaction((depts) => {
      for (const d of depts) {
        insertDept.run(...d);
      }
    });

    insertTransaction(defaultDepts);
    console.log(`✅ Seeded ${defaultDepts.length} default colleges and departments.`);
  }
}

initDB();

module.exports = db;
