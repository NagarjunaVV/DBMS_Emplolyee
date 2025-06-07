
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
CREATE TABLE payroll (
    payroll_id VARCHAR(10) PRIMARY KEY,
    employee_id VARCHAR(10),
    salary DECIMAL(10,2),
    bonus DECIMAL(10,2),
    total_pay DECIMAL(10,2),
    pay_date DATE,
    FOREIGN KEY (employee_id) REFERENCES employees(employee_id)
);


select *from payroll;
-- Salary History Table
CREATE TABLE salaryhistory (
    history_id VARCHAR(10) PRIMARY KEY,
    employee_id VARCHAR(10),
    old_salary DECIMAL(10,2),
    new_salary DECIMAL(10,2),
    bonus_salary DECIMAL(10,2),
    effective_date DATE,
    FOREIGN KEY (employee_id) REFERENCES employees(employee_id)
);


-- Deductions Table
CREATE TABLE deductions (
    deduction_id VARCHAR(10) PRIMARY KEY,
    employee_id VARCHAR(10),
    deduction_type VARCHAR(100),
    amount DECIMAL(10,2),
    deduction_date DATE,
    Net_salary DECIMAL(10,2),
    FOREIGN KEY (employee_id) REFERENCES employees(employee_id)
);

select*from  deductions;


-- Benefits Table
CREATE TABLE benefits (
    benefit_id VARCHAR(10) PRIMARY KEY,
    employee_id VARCHAR(10),
    benefit_type VARCHAR(100),
    benefit_amount DECIMAL(10,2),
    start_date DATE,
    net_salary DECIMAL(10,2),
    end_date DATE,
    FOREIGN KEY (employee_id) REFERENCES employees(employee_id)
);

select*from  benefits;