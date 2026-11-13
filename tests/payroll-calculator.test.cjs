'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const source = fs.readFileSync(path.join(__dirname, '../hrm/hrm.js'), 'utf8');
const start = source.indexOf('function kenyaPayrollCalc(');
const end = source.indexOf('\nasync function payrollAudit', start);
assert.notEqual(start, -1, 'HRM payroll calculator must exist');
assert.notEqual(end, -1, 'HRM payroll calculator must end before payroll audit');
const sandbox = {};
vm.runInNewContext(source.slice(start, end) + '\nthis.calculate = kenyaPayrollCalc;', sandbox);
const calculate = sandbox.calculate;
const employee = { basic_salary: 0, employee_pension_contribution: 0, insurance_premiums_monthly: 0, tax_residency: 'resident' };

test('NSSF Tier I is 6% up to KES 9,000', () => {
  const result = calculate(employee, { basic_pay: 9000 });
  assert.equal(result.calculation_snapshot.nssf_tier_i, 540);
  assert.equal(result.calculation_snapshot.nssf_tier_ii, 0);
  assert.equal(result.nssf, 540);
});

test('NSSF Tier II is 6% on pensionable pay above KES 9,000 up to KES 108,000', () => {
  const result = calculate(employee, { basic_pay: 108000 });
  assert.equal(result.calculation_snapshot.nssf_tier_i, 540);
  assert.equal(result.calculation_snapshot.nssf_tier_ii, 5940);
  assert.equal(result.nssf, 6480);
});

test('NSSF is capped at KES 6,480 employee contribution above KES 108,000', () => {
  const result = calculate(employee, { basic_pay: 200000 });
  assert.equal(result.nssf, 6480);
  assert.equal(result.employer_nssf, 6480);
});

test('Employer NSSF matches employee NSSF and is not deducted twice', () => {
  const result = calculate(employee, { basic_pay: 108000 });
  assert.equal(result.employer_nssf, result.nssf);
  const expectedNet = Math.round((result.gross_pay - result.paye - result.nssf - result.shif - result.housing_levy - result.employee_pension_contribution - result.other_deductions + Number.EPSILON) * 100) / 100;
  assert.equal(result.net_pay, expectedNet);
});

test('SHIF minimum and housing levy use the expected rates', () => {
  const result = calculate(employee, { basic_pay: 9000 });
  assert.equal(result.shif, 300);
  assert.equal(result.housing_levy, 135);
  assert.equal(result.employer_housing_levy, 135);
});

test('NSSF uses pensionable pay and excludes fluctuating allowances and overtime when excluded from the base', () => {
  const result = calculate(employee, { basic_pay: 50000, allowances: 5000, overtime_pay: 5000, nssf_pensionable_pay: 50000 });
  assert.equal(result.gross_pay, 60000);
  assert.equal(result.nssf_pensionable_pay, 50000);
  assert.equal(result.nssf, 3000);
  assert.equal(result.calculation_snapshot.nssf_pensionable_pay, 50000);
});

test('AHL uses basic pay plus regular cash allowances, not overtime or irregular taxable cash', () => {
  const result = calculate(employee, {
    basic_pay: 50000,
    allowances: 5000,
    overtime_pay: 5000,
    other_taxable_cash_earnings: 10000,
    nssf_pensionable_pay: 50000,
    housing_levy_pensionable_pay: 55000
  });
  assert.equal(result.gross_pay, 70000);
  assert.equal(result.other_taxable_cash_earnings, 10000);
  assert.equal(result.housing_levy_pensionable_pay, 55000);
  assert.equal(result.housing_levy, 825);
  assert.equal(result.employer_housing_levy, 825);
});

test('NSSF pensionable pay cannot exceed gross pay', () => {
  assert.throws(() => calculate(employee, { basic_pay: 50000, nssf_pensionable_pay: 55000 }));
});

test('NSSF and other pension contributions share the KES 30,000 PAYE deduction cap', () => {
  const pensionEmployee = { ...employee, employee_pension_contribution: 30000 };
  const result = calculate(pensionEmployee, { basic_pay: 200000 });
  assert.equal(result.calculation_snapshot.nssf_and_pension_allowable_deduction, 30000);
  assert.equal(result.calculation_snapshot.taxable_pay, 200000 - result.shif - result.housing_levy - 30000);
});

test('Calculator records a versioned statutory rule set', () => {
  const result = calculate(employee, { basic_pay: 50000 });
  assert.equal(result.calculation_snapshot.rule_set, 'KE-2026-Y4-NSSF-AHL-PENSIONABLE-BASE');
});

test('Negative payroll inputs are rejected', () => {
  assert.throws(() => calculate(employee, { basic_pay: -1 }));
});
