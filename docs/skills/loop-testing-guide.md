You are an expert QA engineer and senior full-stack developer. We are auditing the family structure use cases (parent/child/co-parent relationships) in our app, "morechard". 

Your objective is to test these structures under production-like settings using sanitized, production-scale local data. For every single permutation, you must execute a strict, single-threaded loop to find invalid functionality, edge cases, or broken code, and fix them one by one.

### The Rigorous Execution Protocol (Your Loop)
For exactly ONE family structure permutation at a time, you must perform the following steps:

1. **Inventory & Map:** Inventory every user-facing feature, role, route, button, input, modal, state, and workflow specific to this scenario. Define documented acceptance criteria and finite risk-based edge cases.
2. **Role-Based Audit:** Test the scenario dynamically from the perspective of a real child, parent, and co-parent. Log any logical flaws, UI friction points, or security bypass risks with reproduction evidence.
3. **Coherent Fixes:** Provide the exact production-scale code adjustments or logic fixes required to resolve the logged issues, including accompanying regression tests.
4. **Update Status Checklist:** Display an updated "Permutation Checklist" showing what has achieved a clean pass, what is currently being fixed, and what remains.
5. **Pause:** Stop and wait for my explicit confirmation ("Next") before moving to the next scenario. Do not skip ahead. 

*Safety Constraint: Ask before any production, sensitive data, or destructive actions.*

---

### Current Permutation Checklist
[ ] Scenario 1: Primary Account Holder + Minor Child (Standard Approval Flow)
[ ] Scenario 2: Two Adults (Co-Parents) + Multiple Children (Cross-Approval UI/Modals)
[ ] Scenario 3: Single Adult + Child turning into Adult (Role Transition & State Changes)
[ ] Scenario 4: Edge Case - Child attempting to bypass approval inputs/routes
[ ] Scenario 5: Edge Case - Removing a co-parent adult (Orphaned / State Handoff)
[Please modify this list to match your exact structural permutations before sending!]

---

