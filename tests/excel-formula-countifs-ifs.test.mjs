import test from "node:test";
import assert from "node:assert/strict";
import { evaluateFormula } from "../lib/excel-formula.ts";

const cell = (value, formula = null) => ({ value, formula });
const cells = {
  A1: cell("F"), A2: cell("M"), A3: cell("F"), A4: cell("F"),
  B1: cell("PASS"), B2: cell("PASS"), B3: cell("FAIL"), B4: cell("PASS"),
  C1: cell(200), C2: cell(150), C3: cell(90), C4: cell(310),
  D1: cell(80),
};

test("COUNTIFS, SUMIFS and AVERAGEIFS need every condition (Excel 2013 functions used by EXCEL TEST 4)", () => {
  assert.equal(evaluateFormula('=COUNTIFS(A1:A4,"F",B1:B4,"PASS")', cells), 2);
  assert.equal(evaluateFormula('=COUNTIFS(C1:C4,">=150")', cells), 3);
  assert.equal(evaluateFormula('=SUMIFS(C1:C4,A1:A4,"F",C1:C4,">100")', cells), 510);
  assert.equal(evaluateFormula('=AVERAGEIFS(C1:C4,B1:B4,"PASS",A1:A4,"<>M")', cells), 255);
  assert.equal(evaluateFormula('=AVERAGEIFS(C1:C4,A1:A4,"X")', cells), "#DIV/0!");
  assert.equal(evaluateFormula('=COUNTIFS(A1:A4,"F",B1:B3,"PASS")', cells), "#VALUE!", "ranges of different sizes");
});

test("IFS returns the value of the first TRUE condition, #N/A when none is TRUE; nested IF gives the same", () => {
  const grade = (f) => evaluateFormula(f, cells);
  assert.equal(grade('=IFS(D1>=75,"A",D1>=60,"B",D1>=40,"C",D1<40,"D")'), "A");
  assert.equal(grade('=IF(D1>=75,"A",IF(D1>=60,"B",IF(D1>=40,"C","D")))'), "A");
  assert.equal(grade('=IFS(D1>100,"X")'), "#N/A");
  assert.equal(grade('=IF(D1<>80,"no","yes")'), "yes");
  assert.equal(grade('=IF(AND(C1>=160,D1>=25),"Selected","Not Selected")'), "Selected");
  assert.equal(grade('=IF(OR(C3>=90,D1>=90),"Yes","No")'), "Yes");
});

test("SUM skips the AB of an absent student, + gives #VALUE!; COUNT leaves AB out, COUNTA counts it", () => {
  const sheet = { F2: cell(92), G2: cell("AB"), H2: cell(66), I2: cell(58) };
  assert.equal(evaluateFormula("=SUM(F2:I2)", sheet), 216);
  assert.equal(evaluateFormula("=F2+G2+H2+I2", sheet), "#VALUE!");
  assert.equal(evaluateFormula("=COUNT(F2:I2)", sheet), 3);
  assert.equal(evaluateFormula("=COUNTA(F2:I2)", sheet), 4);
});
