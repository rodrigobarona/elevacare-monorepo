# WorkOS FGA Evaluation for Eleva Care

**Date:** November 13, 2partner_admin25  
**Status:** Architecture Decision Record  
**Decision:** Recommendation on whether to adopt WorkOS FGA

---

## Executive Summary

**Recommendation:** **Not needed for Phase 1, consider for Phase 2/3**

Your current RBAC + Neon RLS architecture already provides fine-grained access control at the database level. FGA would add complexity and cost without significant immediate benefits. However, FGA could become valuable for specific Phase 2/3 features like resource sharing and collaboration.

---

## Current Architecture Analysis

### What You Have

```
┌──────────────────────────────────────────────────────┐
│ Application Layer                                     │
│ ┌─────────────────────────────────────────────────┐  │
│ │ WorkOS RBAC                                      │  │
│ │ • 132 permissions across 25 categories          │  │
│ │ • 6 roles with inheritance                      │  │
│ │ • Permissions in JWT claims                     │  │
│ └─────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────┐
│ Database Layer (PostgreSQL via Neon.tech)           │
│ ┌─────────────────────────────────────────────────┐  │
│ │ Row-Level Security (RLS)                         │  │
│ │ • JWT validation via auth.user_id()             │  │
│ │ • Org-per-user isolation                        │  │
│ │ • Fine-grained data access control              │  │
│ └─────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

**Key Point:** Your RLS policies already enforce fine-grained access control!

### What You're Missing (That FGA Provides)

1. **Centralized Authorization Logic** - Currently split between app code and RLS policies
2. **Complex Relationship Modeling** - Hard to express in RLS (e.g., "manager of owner of document")
3. **Dynamic Resource Sharing** - Sharing specific resources between users
4. **Audit Trail** - Centralized log of all authorization checks

---

## Use Case Comparison

### ✅ Covered by Current Architecture (RBAC + RLS)

#### 1. **Role-Based Access Control**

**Current Solution:** WorkOS RBAC ✅

```typescript
// Permission check in JWT
if (session.permissions.includes('appointments:view_incoming')) {
  // Show incoming appointments
}
```

**With FGA:** Would work, but adds unnecessary complexity ❌

#### 2. **User Data Isolation**

**Current Solution:** Neon RLS ✅

```sql
-- RLS Policy
CREATE POLICY "users_own_data" ON appointments
  FOR SELECT USING (auth.user_id() = user_id);
```

**With FGA:** Would need to create warrants for every data relationship ❌

#### 3. **Organization Isolation (Org-per-User)**

**Current Solution:** Neon RLS ✅

```sql
-- RLS Policy
CREATE POLICY "org_isolation" ON users
  FOR ALL USING (auth.user_id() = workos_user_id);
```

**With FGA:** Possible but more complex ❌

---

### 🤔 Partially Covered (Could Benefit from FGA)

#### 1. **Expert-Patient Relationships**

**Current Solution:** Managed via appointment records + RLS policies

```sql
-- Expert can see patients they have appointments with
CREATE POLICY "expert_patients" ON users
  FOR SELECT USING (
    auth.user_id() IN (
      SELECT expert_id FROM appointments
      WHERE patient_id = id
    )
  );
```

**With FGA:** More natural relationship modeling

```fga
type patient
type expert
  relation patient [patient]
  relation can_view_profile []
  inherit can_view_profile if
    relation patient
```

**Verdict:** Current solution works, FGA not necessary ✅

#### 2. **Session Notes Sharing**

**Current Solution:** Direct database relationship

```sql
-- Session notes belong to sessions, which belong to appointments
CREATE POLICY "expert_session_notes" ON session_notes
  FOR SELECT USING (
    session_id IN (
      SELECT id FROM sessions
      WHERE expert_id = auth.user_id()
    )
  );
```

**With FGA:** Could model sharing explicitly

```fga
type session_note
  relation owner [expert]
  relation shared_with [patient]
  relation can_view []
  inherit can_view if
    any_of
      relation owner
      relation shared_with
```

**Verdict:** Current solution sufficient for now ✅

---

### ❌ NOT Covered (FGA Would Help)

#### 1. **Resource-Level Sharing (Not Yet Implemented)**

**Example Use Case:**

- Expert wants to share specific session notes with another expert
- Patient wants to grant access to their records to a family member
- Partner admin wants to share specific reports with external auditors

**Current Solution:** Not easily achievable with RLS alone ❌

**With FGA:** Natural fit ✅

```fga
type session_note
  relation owner [expert]
  relation shared_with [expert, patient, user]
  relation can_view []
  inherit can_view if
    any_of
      relation owner
      relation shared_with
```

**Verdict:** Would benefit from FGA, but **not needed for Phase 1** 🔮

#### 2. **Delegation & Complex Hierarchies (Future Partner Features)**

**Example Use Case:**

- Partner admin delegates scheduling permissions to office manager
- Department head has access to all team members' data
- Regional manager oversees multiple partner locations

**Current Solution:** Hard to model in RLS ❌

**With FGA:** Perfect use case ✅

```fga
type partner
  relation admin [user]
  relation member [user]
  relation can_manage_schedule []

type expert
  relation partner [partner]
  relation can_view_data []

  inherit can_view_data if
    relation admin on partner [partner]
```

**Verdict:** Important for **Phase 2 partner features** 🔮

#### 3. **Document/Content Collaboration (Not Planned)**

**Example Use Case:**

- Multiple experts collaborating on treatment plans
- Shared patient care documents
- Collaborative research notes

**Current Solution:** Not implemented ❌

**With FGA:** Excellent fit (Google Docs-style sharing) ✅

**Verdict:** Only if you add collaboration features 🔮

---

## Cost-Benefit Analysis

### Costs of Adding FGA

#### 1. **Complexity**

- **Learning Curve:** New authorization model to understand
- **Schema Design:** Need to design and maintain FGA schema
- **Dual Systems:** Managing both RBAC and FGA simultaneously
- **Migration:** Migrating existing RLS policies to FGA

#### 2. **Development Time**

- **Initial Setup:** 2-3 weeks to design schema and integrate
- **Testing:** Comprehensive testing of authorization logic
- **Documentation:** Team training and docs
- **Maintenance:** Ongoing schema updates

#### 3. **Financial Cost**

- **WorkOS FGA Pricing:** Additional cost on top of RBAC
- **API Calls:** Check/Query API calls can add up
- **Monitoring:** Additional monitoring and logging

#### 4. **Performance Considerations**

- **API Latency:** External API calls for checks (vs. local RLS)
- **Database Complexity:** Less work at database level, more at app level
- **Caching:** Need to implement caching strategy

### Benefits of Adding FGA

#### 1. **Centralized Authorization**

- **Single Source of Truth:** All authorization logic in one place
- **Consistency:** Same authorization model across all services
- **Auditability:** Central log of all authorization decisions

#### 2. **Flexibility**

- **Dynamic Relationships:** Easy to create/modify resource relationships
- **Complex Rules:** Express complex inheritance and hierarchy rules
- **Runtime Changes:** Update authorization without code deploys

#### 3. **Scalability**

- **Relationship Queries:** Fast "list all resources user can access" queries
- **Bulk Operations:** Efficient bulk authorization checks
- **Multi-Service:** Works across multiple microservices

---

## Decision Matrix

### Phase 1: Current Features (Patient + Expert Platform)

| Feature                     | Current Solution  | Need FGA? | Reason                         |
| --------------------------- | ----------------- | --------- | ------------------------------ |
| User authentication         | WorkOS AuthKit ✅ | ❌ No     | AuthKit sufficient             |
| Role-based permissions      | WorkOS RBAC ✅    | ❌ No     | RBAC covers this               |
| Data isolation              | Neon RLS ✅       | ❌ No     | RLS works perfectly            |
| Appointment access          | RLS policies ✅   | ❌ No     | DB relationships handle this   |
| Expert-patient relationship | RLS policies ✅   | ❌ No     | Appointment-based access works |
| Session notes               | RLS policies ✅   | ❌ No     | Ownership clear via DB         |

**Phase 1 Verdict:** ❌ **FGA NOT NEEDED**

---

### Phase 2: Partner Features

| Feature                    | Current Solution  | Need FGA? | Reason                             |
| -------------------------- | ----------------- | --------- | ---------------------------------- |
| Partner team management    | WorkOS Orgs + RLS | ⚠️ Maybe  | Could simplify complex hierarchies |
| Shared patient access      | RLS policies      | ⚠️ Maybe  | FGA better for dynamic sharing     |
| Delegation                 | Not implemented   | ✅ Yes    | Natural FGA use case               |
| Department hierarchies     | Not implemented   | ✅ Yes    | Complex relationships              |
| Resource-level permissions | Not implemented   | ✅ Yes    | Per-resource access control        |

**Phase 2 Verdict:** ✅ **FGA WOULD BE BENEFICIAL**

---

### Phase 3: Advanced Features (Hypothetical)

| Feature                | Current Solution | Need FGA? | Reason                    |
| ---------------------- | ---------------- | --------- | ------------------------- |
| Document collaboration | Not planned      | ✅ Yes    | Perfect for FGA           |
| External sharing       | Not planned      | ✅ Yes    | Dynamic resource sharing  |
| API partner access     | Not planned      | ✅ Yes    | Third-party authorization |
| Multi-tenant SaaS      | Not planned      | ✅ Yes    | Complex tenant isolation  |

**Phase 3 Verdict:** ✅ **FGA HIGHLY RECOMMENDED**

---

## Recommendation

### Immediate Action (Phase 1)

**❌ Do NOT implement FGA now**

**Reasons:**

1. ✅ **Your current architecture is sufficient** - RBAC + RLS already provides fine-grained access control
2. ✅ **Cost-effective** - No additional WorkOS costs, no API latency
3. ✅ **Simpler** - Less complexity, fewer moving parts
4. ✅ **Proven** - RLS is battle-tested for access control
5. ✅ **Performant** - Database-level checks are faster than external API calls

**Continue using:**

- WorkOS RBAC for role-based permissions
- Neon RLS for fine-grained data access control
- Database relationships for expert-patient connections

---

### Future Consideration (Phase 2)

**✅ Evaluate FGA when implementing partner features**

**Trigger Criteria:**

- [ ] Need to delegate permissions dynamically
- [ ] Complex organizational hierarchies (departments, regions)
- [ ] Resource-level sharing between users
- [ ] Temporary access grants
- [ ] External party access (auditors, consultants)

**Implementation Strategy:**

1. **Hybrid Approach:** Keep RLS for basic data isolation, add FGA for complex relationships
2. **Gradual Migration:** Start with new partner features, migrate existing gradually
3. **Testing:** Extensive testing in staging before production

---

### When to Definitely Use FGA

**Strong indicators you need FGA:**

1. **Collaboration Features**
   - Users sharing resources with specific other users
   - Google Docs-style permissions (owner/editor/viewer per document)
   - Temporary access grants

2. **Complex Hierarchies**
   - Multi-level organizational structures
   - Role inheritance across multiple dimensions
   - Regional/departmental access control

3. **Dynamic Relationships**
   - User-to-resource relationships change frequently
   - Need to query "what can this user access?" efficiently
   - Relationship-based access (e.g., "manager of owner of document")

4. **Third-Party Access**
   - External partners need access to specific resources
   - API consumers with custom permission models
   - Customer-managed access control

5. **Audit Requirements**
   - Need centralized authorization audit log
   - Compliance requires detailed access tracking
   - Security team needs single authorization monitoring point

---

## Implementation Roadmap (If Needed)

### Phase 1: Planning (2 weeks)

- [ ] Audit current authorization patterns
- [ ] Identify FGA use cases
- [ ] Design FGA schema
- [ ] Cost analysis
- [ ] Team training

### Phase 2: Development (3-4 weeks)

- [ ] Setup FGA environment
- [ ] Apply schema
- [ ] Implement Check/Query API integration
- [ ] Build abstraction layer
- [ ] Add caching

### Phase 3: Migration (2-3 weeks)

- [ ] Start with new features
- [ ] Parallel run (FGA + RLS)
- [ ] Gradual migration
- [ ] Remove old RLS policies
- [ ] Performance testing

### Phase 4: Production (1 week)

- [ ] Monitoring setup
- [ ] Rollout to production
- [ ] Team documentation
- [ ] Incident response plan

**Total Timeline:** 8-1partner_admin weeks

---

## Alternative: Hybrid Approach

If you decide you need FGA for specific features but want to keep RLS:

### Best of Both Worlds

```
┌─────────────────────────────────────────────┐
│ Application Layer                            │
│ ┌────────────────┐  ┌────────────────────┐  │
│ │ WorkOS RBAC    │  │ WorkOS FGA         │  │
│ │ Role-based     │  │ Resource-level     │  │
│ │ permissions    │  │ relationships      │  │
│ └────────────────┘  └────────────────────┘  │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│ Database Layer                               │
│ ┌────────────────────────────────────────┐  │
│ │ Neon RLS (Basic Isolation)             │  │
│ │ • Org-per-user isolation               │  │
│ │ │ Simple ownership checks              │  │
│ └────────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

**Use RBAC for:** Role-based permissions (e.g., "Expert Top can view analytics")  
**Use FGA for:** Resource-level sharing (e.g., "User A can edit Report X")  
**Use RLS for:** Basic data isolation (e.g., "Users can only see their org's data")

---

## Summary

### Current State

✅ **Well-architected** - Your RBAC + RLS combination is solid  
✅ **Sufficient for Phase 1** - Covers all current use cases  
✅ **Cost-effective** - No additional infrastructure needed  
✅ **Performant** - Database-level checks are fast

### Future State

🔮 **Phase 2 Consideration** - Evaluate for partner features  
🔮 **Collaboration Features** - Strong case for FGA  
🔮 **Complex Hierarchies** - FGA excels here  
🔮 **Hybrid Approach** - Use both FGA and RLS for different purposes

### Bottom Line

**For now: ❌ Skip FGA, continue with RBAC + RLS**

Your current architecture is well-designed and sufficient. FGA would add complexity and cost without immediate benefits. Revisit this decision when implementing Phase 2 partner features or if you add collaboration/sharing functionality.

---

**Document Version:** 1.partner_admin  
**Last Updated:** November 13, 2partner_admin25  
**Next Review:** Before Phase 2 development starts  
**Decision Owner:** Architecture Team
