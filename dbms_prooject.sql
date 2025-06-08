
CREATE DATABASE companydb;
USE companydb;

-- Departments Table
CREATE TABLE departments (
    department_id VARCHAR(10) PRIMARY KEY,
    department_name VARCHAR(100),
    location VARCHAR(255)
);

INSERT INTO departments VALUES
('DP1', 'Human Resources', 'Delhi'),
('DP2', 'Engineering', 'Bangalore'),
('DP3', 'Finance', 'Mumbai'),
('DP4', 'Marketing', 'Hyderabad'),
('DP5', 'Sales', 'Chennai'),
('DP6', 'IT', 'Pune'),
('DP7', 'Logistics', 'Ahmedabad'),
('DP8', 'Legal', 'Kolkata'),
('DP9', 'Customer Service', 'Jaipur'),
('DP10', 'Research', 'Lucknow');


select*from  departments;


-- Employees Table
CREATE TABLE employees (
    employee_id VARCHAR(10) PRIMARY KEY,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    date_of_birth DATE,
    hire_date DATE,
    email VARCHAR(100),
    phone_number VARCHAR(20),
    department_id VARCHAR(10),
    position VARCHAR(100),
    status ENUM('active', 'inactive'),
    FOREIGN KEY (department_id) REFERENCES departments(department_id)
);

select*from employees;

-- Managers Table
CREATE TABLE managers (
    manager_id VARCHAR(10) PRIMARY KEY,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    email VARCHAR(100),
    phone_number VARCHAR(20),
    department_id VARCHAR(10),
    position VARCHAR(100),
    hire_date DATE,
    status ENUM('active', 'inactive'),
    FOREIGN KEY (department_id) REFERENCES departments(department_id)
);

select*from managers;

DROP TABLE IF EXISTS user_credentials;
CREATE TABLE user_credentials (
    user_id VARCHAR(10) PRIMARY KEY,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('manager', 'employee') NOT NULL,
    FOREIGN KEY (user_id) REFERENCES managers(manager_id)
        ON DELETE CASCADE ON UPDATE CASCADE
);
select*from user_credentials;

CREATE TABLE employee_credentials (
    user_id VARCHAR(10) PRIMARY KEY,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('employee') NOT NULL DEFAULT 'employee',
    FOREIGN KEY (user_id) REFERENCES employees(employee_id)
        ON DELETE CASCADE ON UPDATE CASCADE
);
select*from employee_credentials;

-- Attendance Table
CREATE TABLE attendance (
    attendance_id VARCHAR(10) PRIMARY KEY,
    employee_id VARCHAR(10),
    date DATE,
    check_in TIME,
    check_out TIME,
    status ENUM('present', 'absent', 'late', 'half-day'),
    hours_worked DECIMAL(5,2),
    remarks VARCHAR(255),
    FOREIGN KEY (employee_id) REFERENCES employees(employee_id)
);


select*from attendance;

-- Payroll Table
drop table payroll;
CREATE TABLE payroll (
    payroll_id VARCHAR(10) PRIMARY KEY,
    employee_id VARCHAR(10),
    salary DECIMAL(10,2),
    bonus DECIMAL(10,2),
    total_pay DECIMAL(10,2),
    pay_date DATE,
    FOREIGN KEY (employee_id) REFERENCES employees(employee_id)
);
ALTER TABLE payroll
ADD COLUMN deduction DECIMAL(10,2);

select *from payroll;
-- Salary History Table
-- CREATE TABLE salary_history (
--     history_id VARCHAR(10) PRIMARY KEY,
--     employee_id VARCHAR(10),
--     old_salary DECIMAL(10,2),
--     new_salary DECIMAL(10,2),
--     bonus_salary DECIMAL(10,2),
--     effective_date DATE,
--     FOREIGN KEY (employee_id) REFERENCES employees(employee_id)
-- );
-- select *from salary_history;
-- ALTER TABLE salary_history
-- ADD COLUMN total_pay DECIMAL(10,2);


-- Deductions Table
drop table deductions;
CREATE TABLE deductions (
    deduction_id VARCHAR(10) PRIMARY KEY,
    employee_id VARCHAR(10),
    deduction_type VARCHAR(100),
    amount DECIMAL(10,2),
    deduction_date DATE,
   
    FOREIGN KEY (employee_id) REFERENCES employees(employee_id)
);

select*from  deductions;
drop table salary_payment;
CREATE TABLE salary_payments (
  salary_id VARCHAR(20) PRIMARY KEY,
  employee_id VARCHAR(20) NOT NULL,
  salary_amount DECIMAL(10,2),
   status VARCHAR(20),
  paying_amount DECIMAL(10, 2) NOT NULL,
FOREIGN KEY (employee_id) REFERENCES employees(employee_id)
);
ALTER TABLE salary_payments
ADD COLUMN paid_amount DECIMAL(10,2);
ALTER TABLE salary_payments CHANGE paying_amount paid_amount DECIMAL(10,2);
ALTER TABLE salary_payments DROP COLUMN paying_amount;
select *from salary_payments;
-- Benefits Table
drop table benefits;
CREATE TABLE benefits (
  benefit_id VARCHAR(20) PRIMARY KEY,
  employee_id VARCHAR(20) NOT NULL,
  salary_id VARCHAR(20) NOT NULL,
  benefit_type VARCHAR(50) NOT NULL,
  benefit_amount DECIMAL(10, 2) NOT NULL,
  effective_date DATE NOT NULL,
  FOREIGN KEY (employee_id) REFERENCES employees(employee_id),
  FOREIGN KEY (salary_id) REFERENCES salary_payments(salary_id)
);

select*from  benefits;
SELECT employee_id FROM employees WHERE employee_id = 'YOUR_EMPLOYEE_ID';
SELECT salary_id FROM salary_payments WHERE salary_id = 'YOUR_SALARY_ID';
CREATE TABLE salary_payment (
    employee_id VARCHAR(20) NOT NULL,
    salary_id VARCHAR(20) NOT NULL,
    salary_amount DECIMAL(10, 2) NOT NULL,
    paying_amount DECIMAL(10, 2) NOT NULL
);
/*
CREATE TABLE employee_payments (
  payment_id INT AUTO_INCREMENT PRIMARY KEY,
  employee_id VARCHAR(20) NOT NULL,
  salary DECIMAL(10, 2) NOT NULL,
  benefits DECIMAL(10, 2) NOT NULL,
  deductions DECIMAL(10, 2) NOT NULL,
  net_salary DECIMAL(10, 2) AS (salary + benefits - deductions) ,
 
  FOREIGN KEY (employee_id) REFERENCES employees(employee_id)
);

select *from employee_payments;
*/