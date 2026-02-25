# Postman Testing Guide

Base URL: `http://localhost:5111`
Auth header: `Authorization: Bearer <token>` on all protected routes.

Work through the sections **in order** — each step produces tokens/IDs used by the next.

---

## 1. Bootstrap Superadmin

**POST** `/api/user/createSuperAdmin`
No auth required.

```json
{
  "adminSecret": "<your ADMIN_SECRET from .env>",
  "username": "superadmin",
  "email": "super@admin.com",
  "password": "superpass123"
}
```

**Expected:** `200 ok:true` with `longToken` and `role: "superadmin"`.
Save the token as **SUPERADMIN_TOKEN**.

> Calling this a second time returns `409 a superadmin account already exists`.

---

## 2. Login (any role)

**POST** `/api/user/loginUser`
No auth required.

```json
{
  "email": "super@admin.com",
  "password": "superpass123"
}
```

**Expected:** `200 ok:true` with `longToken` and `role`.

---

## 3. Schools

### 3a. Create School

**POST** `/api/school/createSchool`
Auth: `SUPERADMIN_TOKEN`

```json
{
  "name": "Lincoln High School",
  "address": "123 Main Street",
  "phone": "555-1234",
  "email": "info@lincoln.edu"
}
```

**Expected:** `200 ok:true` with `school` object.
Save `school._id` as **SCHOOL_ID**.

---

### 3b. Get School

**GET** `/api/school/getSchool?id=<SCHOOL_ID>`
Auth: `SUPERADMIN_TOKEN`

**Expected:** `200 ok:true` with `school` object.

---

### 3c. List Schools

**GET** `/api/school/listSchools`
Auth: `SUPERADMIN_TOKEN`

**Expected:** `200 ok:true` with `schools` array.

---

### 3d. Update School

**PUT** `/api/school/updateSchool`
Auth: `SUPERADMIN_TOKEN`

```json
{
  "id": "<SCHOOL_ID>",
  "name": "Lincoln High School (Updated)",
  "phone": "555-9999"
}
```

**Expected:** `200 ok:true` with updated `school` object.

---

### 3e. Create School Admin

**POST** `/api/school/createSchoolAdmin`
Auth: `SUPERADMIN_TOKEN`

```json
{
  "schoolId": "<SCHOOL_ID>",
  "username": "schooladmin1",
  "email": "admin@lincoln.edu",
  "password": "adminpass123"
}
```

**Expected:** `200 ok:true` with `user` object.

---

### 3f. List School Admins

**GET** `/api/school/listSchoolAdmins?schoolId=<SCHOOL_ID>`
Auth: `SUPERADMIN_TOKEN`

**Expected:** `200 ok:true` with `admins` array and `pagination`.

---

## 4. Login as School Admin

**POST** `/api/user/loginUser`

```json
{
  "email": "admin@lincoln.edu",
  "password": "adminpass123"
}
```

**Expected:** `200 ok:true` with `longToken` and `role: "schoolAdmin"`.
Save the token as **SCHOOL_ADMIN_TOKEN**.

---

## 5. Classrooms

### 5a. Create Classroom

**POST** `/api/classroom/createClassroom`
Auth: `SCHOOL_ADMIN_TOKEN`

```json
{
  "name": "Room 101",
  "capacity": 30,
  "resources": "Projector, Whiteboard"
}
```

**Expected:** `200 ok:true` with `classroom` object.
Save `classroom._id` as **CLASSROOM_ID**.

---

### 5b. Get Classroom

**GET** `/api/classroom/getClassroom?id=<CLASSROOM_ID>`
Auth: `SCHOOL_ADMIN_TOKEN`

**Expected:** `200 ok:true` with `classroom` object.

---

### 5c. List Classrooms

**GET** `/api/classroom/listClassrooms`
Auth: `SCHOOL_ADMIN_TOKEN`

**Expected:** `200 ok:true` with `classrooms` array scoped to admin's school.

---

### 5d. Update Classroom

**PUT** `/api/classroom/updateClassroom`
Auth: `SCHOOL_ADMIN_TOKEN`

```json
{
  "id": "<CLASSROOM_ID>",
  "name": "Room 101 (Lab)",
  "capacity": 25
}
```

**Expected:** `200 ok:true` with updated `classroom`.

---

## 6. Students

### 6a. Create Student

**POST** `/api/student/createStudent`
Auth: `SCHOOL_ADMIN_TOKEN`

```json
{
  "name": "Jane Doe",
  "email": "jane@students.lincoln.edu",
  "age": 16,
  "username": "janedoe",
  "password": "studentpass123",
  "classroomId": "<CLASSROOM_ID>"
}
```

**Expected:** `200 ok:true` with `student` object.
Save `student.id` as **STUDENT_ID**.

> This also creates a linked user account with `role: "student"`.

---

### 6b. Get Student

**GET** `/api/student/getStudent?id=<STUDENT_ID>`
Auth: `SCHOOL_ADMIN_TOKEN`

**Expected:** `200 ok:true` with `student` object (school and classroom names populated).

---

### 6c. List Students

**GET** `/api/student/listStudents`
Auth: `SCHOOL_ADMIN_TOKEN`

**Expected:** `200 ok:true` with `students` array scoped to admin's school.

Filter by classroom:

**GET** `/api/student/listStudents?classroomId=<CLASSROOM_ID>`
Auth: `SCHOOL_ADMIN_TOKEN`

---

### 6d. Update Student

**PUT** `/api/student/updateStudent`
Auth: `SCHOOL_ADMIN_TOKEN`

```json
{
  "id": "<STUDENT_ID>",
  "name": "Jane M. Doe",
  "age": 17
}
```

**Expected:** `200 ok:true` with updated `student`.

---

## 7. Login as Student

**POST** `/api/user/loginUser`

```json
{
  "email": "jane@students.lincoln.edu",
  "password": "studentpass123"
}
```

**Expected:** `200 ok:true` with `longToken` and `role: "student"`.
Save the token as **STUDENT_TOKEN**.

---

## 8. Student Profile

**GET** `/api/student/myProfile`
Auth: `STUDENT_TOKEN`

**Expected:** `200 ok:true` with the student's own profile, school name, and classroom name populated.

---

## 9. Transfer Student

Create a second school first (as superadmin), then transfer.

### 9a. Create Second School

**PUT** `/api/school/createSchool`
Auth: `SUPERADMIN_TOKEN`

```json
{
  "name": "Riverside Academy",
  "address": "456 Oak Avenue"
}
```

Save `school._id` as **SCHOOL_2_ID**.

---

### 9b. Transfer

**POST** `/api/student/transferStudent`
Auth: `SCHOOL_ADMIN_TOKEN`

```json
{
  "studentId": "<STUDENT_ID>",
  "targetSchoolId": "<SCHOOL_2_ID>"
}
```

**Expected:** `200 ok:true` with updated `student` showing new `schoolId`, and `message: "student transferred successfully"`.

> `targetClassroomId` is optional — omit it to transfer without assigning a classroom.

---

## 10. Delete Student

**DELETE** `/api/student/deleteStudent`
Auth: `SCHOOL_ADMIN_TOKEN`

```json
{
  "id": "<STUDENT_ID>"
}
```

**Expected:** `200 ok:true` with `message: "student deleted successfully"`.
This also deletes the linked user account.

---

## 11. Delete Classroom

**DELETE** `/api/classroom/deleteClassroom`
Auth: `SCHOOL_ADMIN_TOKEN`

```json
{
  "id": "<CLASSROOM_ID>"
}
```

---

## 12. Delete School

**DELETE** `/api/school/deleteSchool`
Auth: `SUPERADMIN_TOKEN`

```json
{
  "id": "<SCHOOL_ID>"
}
```

**Expected:** `200 ok:true` with `message: "school deleted successfully"`.

> **Cascade:** deleting a school also permanently deletes all of its classrooms and school admin accounts. Students are not deleted — they remain and can be transferred to another school.

---

## RBAC Checks (verify these return errors)

| Request | Expected |
|---|---|
| `createSchool` with `SCHOOL_ADMIN_TOKEN` | `403 forbidden: superadmin access required` |
| `createClassroom` with `SUPERADMIN_TOKEN` | `403 forbidden: school admin access required` |
| `myProfile` with `SCHOOL_ADMIN_TOKEN` | `403 forbidden: student access required` |
| Any protected route with no token | `401 unauthorized` |
| Any protected route with an invalid token | `401 unauthorized` |

---

## Validation Error Examples (verify these return 400)

**Missing required field:**
```json
POST /api/school/createSchool
{ "address": "123 Main St" }
```
Expected: `400 ok:false` with `errors` array listing missing `name`.

**Invalid email:**
```json
POST /api/user/loginUser
{ "email": "notanemail", "password": "pass1234" }
```
Expected: `400 ok:false` with validation errors.

**Duplicate email:**
```json
POST /api/user/createSuperAdmin  (called twice)
```
Expected: `409 a superadmin account already exists`.
