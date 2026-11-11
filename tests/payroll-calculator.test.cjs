'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const source = fs.readFileSync(path.join(__dirname, '../company-portal/hrm.js'), 'utf8');
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
  assert.equal(result.net_pay, result.gross_pay - result.paye - result.nssf - result.shif - result.housing_levy - result.employee_pension_contribution - result.other_deductions);
});

test('SHIF minimum and housing levy use the expected rates', () => {
  const result = calculate(employee, { basic_pay: 9000 });
  assert.equal(result.shif, 300);
  assert.equal(result.housing_levy, 135);
  assert.equal(result.employer_housing_levy, 135);
});

test('Calculator records a versioned statutory rule set', () => {
  const result = calculate(employee, { basic_pay: 50000 });
  assert.equal(result.calculation_snapshot.rule_set, 'KE-2026-Y4-NSSF-CAPS');
});

test('Negative payroll inputs are rejected', () => {
  assert.throws(() => calculate(employee, { basic_pay: -1 }));
});
