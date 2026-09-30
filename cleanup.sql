DELETE FROM user_hospitals
WHERE "userId" IN (SELECT id FROM users WHERE email = 'admin@demo-hospital.dev')
  AND "roleId" IN (SELECT id FROM roles WHERE name = 'PATIENT');

SELECT r.name FROM user_hospitals uh
  JOIN roles r ON r.id = uh."roleId"
  JOIN users u ON u.id = uh."userId"
  WHERE u.email = 'admin@demo-hospital.dev';