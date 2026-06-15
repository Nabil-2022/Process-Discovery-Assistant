# RBAC Matrix

| Resource | super_admin | tenant_admin | direction_referent | validator | consultant | readonly |
| --- | --- | --- | --- | --- | --- | --- |
| Tenants admin | Yes, SaaS scope | No | No | No | No | No |
| Tenant business data | Support grant only | Full tenant | Own directions | Validation scope | Assigned scope | Published/authorized |
| Directions | Support grant only | CRUD | Read own, limited actions | Read validation context | Scoped read | Read authorized |
| Processes | Support grant only | Full tenant | CRUD own directions | Review/validate | Scoped read/write if authorized | Read authorized |
| Wizard | Support grant only | Full tenant | Edit own directions | Read/review | Scoped | Read only |
| Workflow | Support grant only | Submit/publish where permitted | Submit/resubmit | Request changes/approve | Scoped | No mutation |
| RACI | Support grant only | Generate/validate | Generate scoped | Validate where permitted | Scoped | Read |
| BPMN | Support grant only | Generate/validate | Generate scoped | Validate where permitted | Scoped | Read |
| Procedure | Support grant only | Generate/publish | Edit scoped | Review/approve | Scoped | Read published |
| Exports | Support grant only | Export tenant | Export scoped | Export review artifacts | Scoped | Published/authorized |
| AI | Support grant only | Generate/review | Generate scoped | Validate suggestions | Scoped | No mutation |
| Notifications | Personal/support scope | Personal | Personal | Personal | Personal | Personal authorized |
| Tasks | Support grant only | Create/assign | Own/scoped | Validation actions | Scoped | No creation |
| Audit | Support grant only | Tenant audit | Scoped activity | Validation audit | Scoped activity | Limited/published |

Backend tests cover support grant refusal, readonly task refusal, tenant isolation for notifications/tasks/audit/exports, and scoped direction filtering.

