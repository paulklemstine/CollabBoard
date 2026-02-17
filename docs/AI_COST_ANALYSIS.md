# AI Cost Analysis

Financial tracking and optimization for CollabBoard's AI agent powered by Anthropic Claude.

---

## Executive Summary

**Current Status**: 🔴 Not Deployed
**Monthly Budget**: $0 (Not set)
**Actual Spend**: $0
**Cost per User**: N/A

**Budget Status**: ✅ On Track (No spend yet)

---

## Cost Components

### 1. Anthropic Claude API

**Model**: Claude Sonnet 4.5 (claude-sonnet-4-5-20250929)

**Pricing** (as of January 2025):
- **Input tokens**: $3.00 per million tokens
- **Output tokens**: $15.00 per million tokens
- **Context window**: 200K tokens
- **Max output**: 8,192 tokens

**Estimated Token Usage per Request**:

| Component | Tokens | Cost |
|-----------|--------|------|
| **System prompt** | ~300 | $0.0009 |
| **User prompt** (avg) | ~50 | $0.00015 |
| **Board context** (optional) | ~500 | $0.0015 |
| **Tool definitions** | ~400 | $0.0012 |
| **Total Input** | ~1,250 | $0.00375 |
| **AI Response** | ~100 | $0.0015 |
| **Total per request** | ~1,350 | **$0.00525** |

**Cost Estimates by Usage Tier**:

| Monthly Requests | Cost per Month | Cost per User (10 users) | Cost per User (100 users) |
|------------------|----------------|--------------------------|---------------------------|
| 100 | $0.53 | $0.053 | $0.0053 |
| 1,000 | $5.25 | $0.525 | $0.053 |
| 10,000 | $52.50 | $5.25 | $0.525 |
| 100,000 | $525.00 | $52.50 | $5.25 |
| 1,000,000 | $5,250.00 | $525.00 | $52.50 |

---

### 2. Firebase Cloud Functions

**Pricing** (as of January 2025):

**Compute**:
- **Invocations**: $0.40 per million invocations
- **Compute time**: $0.0000167 per GB-second
- **Memory**: 512 MB (default)
- **Estimated duration**: 2-3 seconds per invocation

**Networking**:
- **Egress**: $0.12 per GB (to external APIs)
- **Ingress**: Free

**Estimated Cost per Request**:

| Component | Calculation | Cost |
|-----------|-------------|------|
| **Invocation** | 1 * $0.40 / 1M | $0.0000004 |
| **Compute** | 2.5s * 0.5GB * $0.0000167 | $0.000021 |
| **Network egress** | ~5KB * $0.12/GB | $0.0000006 |
| **Total** | | **$0.0000216** |

**Note**: Firebase free tier includes 2M invocations/month and 400K GB-seconds/month.

---

### 3. Firebase Hosting (Static Files)

**Cost**: $0 (Current usage well within free tier)

**Free tier**: 10 GB storage, 360 MB/day transfer

---

### 4. Firestore (Board Data)

**Current Usage**: Minimal (test data only)

**Free tier**: 1 GB storage, 50K reads/day, 20K writes/day

**Estimated Cost at Scale** (100 active users, 50 boards):
- **Storage**: ~100 MB → $0 (free tier)
- **Reads**: ~100K/day → $0.18/day → $5.40/month
- **Writes**: ~50K/day → $0.54/day → $16.20/month

**Total Firestore**: ~$21.60/month (at scale)

---

### 5. Realtime Database (Cursors/Presence)

**Current Usage**: Minimal

**Free tier**: 1 GB storage, 10 GB/month bandwidth

**Estimated Cost at Scale** (10 concurrent users):
- **Storage**: ~1 MB → $0 (free tier)
- **Bandwidth**: ~5 GB/month → $0 (free tier)

**Total RTDB**: $0 (within free tier)

---

## Total Cost Projection

### Scenario 1: Pilot (10 users, 100 AI requests/month)

| Service | Monthly Cost |
|---------|-------------|
| Claude API | $0.53 |
| Cloud Functions | $0.00 (free tier) |
| Firestore | $0.00 (free tier) |
| RTDB | $0.00 (free tier) |
| **Total** | **$0.53** |

**Cost per user**: $0.053/month

---

### Scenario 2: Small Team (100 users, 1,000 AI requests/month)

| Service | Monthly Cost |
|---------|-------------|
| Claude API | $5.25 |
| Cloud Functions | $0.02 |
| Firestore | $5.00 |
| RTDB | $0.00 (free tier) |
| **Total** | **$10.27** |

**Cost per user**: $0.10/month

---

### Scenario 3: Growing Startup (1,000 users, 10,000 AI requests/month)

| Service | Monthly Cost |
|---------|-------------|
| Claude API | $52.50 |
| Cloud Functions | $0.22 |
| Firestore | $50.00 |
| RTDB | $5.00 |
| **Total** | **$107.72** |

**Cost per user**: $0.11/month

---

### Scenario 4: Scale (10,000 users, 100,000 AI requests/month)

| Service | Monthly Cost |
|---------|-------------|
| Claude API | $525.00 |
| Cloud Functions | $2.16 |
| Firestore | $500.00 |
| RTDB | $50.00 |
| **Total** | **$1,077.16** |

**Cost per user**: $0.11/month

---

## Cost Optimization Strategies

### 1. Claude API Optimization

#### Strategy A: Prompt Engineering
**Goal**: Reduce input token count without sacrificing quality

**Tactics**:
- ✅ Minimize system prompt length (remove verbose examples)
- ✅ Use concise tool descriptions
- ✅ Only pass board context when necessary (e.g., "move the yellow note" requires context, "create a sticky note" doesn't)
- ✅ Use stop sequences to prevent over-generation

**Potential Savings**: 20-30% reduction in token usage

---

#### Strategy B: Caching (Prompt Caching)
**Goal**: Reuse static portions of the prompt (system prompt, tool definitions)

**How it works**:
- Anthropic caches the first part of the prompt
- Subsequent requests with the same cache key pay reduced rates
- Cache hit: 90% discount on cached tokens
- Cache TTL: 5 minutes

**Pricing**:
- **Cache write**: $3.75 per million tokens (input rate + 25%)
- **Cache read**: $0.30 per million tokens (90% discount)

**Example**:
```typescript
const response = await anthropic.messages.create({
  model: "claude-sonnet-4-5-20250929",
  system: [
    {
      type: "text",
      text: SYSTEM_PROMPT, // ~700 tokens
      cache_control: { type: "ephemeral" }
    },
    {
      type: "text",
      text: JSON.stringify(TOOL_DEFINITIONS), // ~400 tokens
      cache_control: { type: "ephemeral" }
    }
  ],
  messages: [{ role: "user", content: userPrompt }]
})
```

**Potential Savings**: 70-80% on repeated requests (if cache hit rate is high)

**Calculation** (1,000 requests/month, 80% cache hit rate):
- **Without caching**: 1,000 * $0.00525 = $5.25
- **With caching**:
  - 200 cache misses: 200 * $0.00525 = $1.05
  - 800 cache hits: 800 * $0.0015 = $1.20 (only user prompt + output)
  - **Total**: $2.25 (**57% savings**)

---

#### Strategy C: Model Selection
**Goal**: Use cheaper models for simple tasks

**Options**:
- **Claude Sonnet 4.5**: $3/$15 per million tokens (input/output) - Current
- **Claude Haiku 4**: $0.80/$4 per million tokens - 75% cheaper

**Tactic**: Route simple commands (e.g., "create a sticky note") to Haiku, complex commands to Sonnet

**Potential Savings**: 50-75% depending on command complexity distribution

---

### 2. Firebase Optimization

#### Strategy A: Firestore Query Optimization
**Goal**: Reduce read/write operations

**Tactics**:
- ✅ Use Firestore local cache (already implemented)
- ✅ Batch writes when possible
- ✅ Use `onSnapshot` efficiently (avoid unnecessary re-subscriptions)
- ❌ Consider pagination for large boards (not implemented yet)

**Potential Savings**: 20-40% reduction in Firestore costs

---

#### Strategy B: RTDB Data Structure Optimization
**Goal**: Minimize bandwidth usage

**Tactics**:
- ✅ Throttle cursor updates (already at 100ms)
- ✅ Use concise field names (e.g., `x`, `y` vs. `xCoordinate`, `yCoordinate`)
- ✅ Clean up stale cursors/presence data

**Potential Savings**: Minimal (already optimized)

---

#### Strategy C: Cloud Functions Cold Start Reduction
**Goal**: Reduce latency and compute costs

**Tactics**:
- ✅ Set `minInstances: 1` (keeps function warm) - **Costs ~$10/month in compute**
- ❌ Use `concurrency: 10` to handle multiple requests per instance (not set yet)
- ❌ Optimize function bundle size (smaller = faster cold starts)

**Trade-off**: `minInstances: 1` costs ~$10/month but eliminates cold starts (3-5s delay)

---

### 3. Rate Limiting & Usage Controls

#### Strategy A: Per-User Rate Limits
**Goal**: Prevent abuse and runaway costs

**Implementation**:
```typescript
// functions/src/middleware/rateLimit.ts
const rateLimiter = new Map<string, { count: number, resetAt: number }>()

function checkRateLimit(userId: string, maxRequests = 10, windowMs = 60000) {
  const now = Date.now()
  const userLimit = rateLimiter.get(userId)

  if (!userLimit || now > userLimit.resetAt) {
    rateLimiter.set(userId, { count: 1, resetAt: now + windowMs })
    return true
  }

  if (userLimit.count >= maxRequests) {
    throw new Error('Rate limit exceeded. Try again in a minute.')
  }

  userLimit.count++
  return true
}
```

**Recommended Limits**:
- **Free tier**: 10 requests/hour per user
- **Paid tier**: 100 requests/hour per user

---

#### Strategy B: Cost Alerts
**Goal**: Get notified before costs spiral

**Setup** (Google Cloud Console):
1. Go to Billing → Budgets & Alerts
2. Create budget: $50/month
3. Set alerts at 50%, 80%, 100%
4. Send to email/Slack

---

#### Strategy C: Graceful Degradation
**Goal**: Disable AI when budget is exceeded

**Implementation**:
```typescript
const MONTHLY_BUDGET_USD = 100
let currentMonthSpend = 0 // Track via Firestore

if (currentMonthSpend >= MONTHLY_BUDGET_USD) {
  return res.status(429).json({
    error: 'AI budget exceeded for this month. Please try again next month.'
  })
}
```

---

## Cost Tracking & Reporting

### Real-Time Cost Tracking (Firestore)

**Document**: `firestore/analytics/ai-usage/{month}`

```typescript
{
  month: "2026-02",
  requests: 1234,
  inputTokens: 1500000,
  outputTokens: 150000,
  estimatedCost: 6.75,
  costPerRequest: 0.00547,
  topUsers: [
    { userId: "user123", requests: 100, cost: 0.55 },
    // ...
  ]
}
```

**Update on each AI request**:
```typescript
await admin.firestore()
  .collection('analytics')
  .doc('ai-usage')
  .doc(currentMonth)
  .update({
    requests: admin.firestore.FieldValue.increment(1),
    inputTokens: admin.firestore.FieldValue.increment(usage.input_tokens),
    outputTokens: admin.firestore.FieldValue.increment(usage.output_tokens),
    estimatedCost: admin.firestore.FieldValue.increment(estimatedCost)
  })
```

---

### Monthly Cost Reports

**Generate on 1st of each month**:

```markdown
## AI Cost Report - February 2026

**Total Requests**: 5,432
**Total Input Tokens**: 6,790,000
**Total Output Tokens**: 543,200
**Estimated Claude Cost**: $28.51
**Estimated Firebase Cost**: $0.12
**Total Estimated Cost**: $28.63

**Top 5 Users by Requests**:
1. user123 - 543 requests ($2.85)
2. user456 - 432 requests ($2.27)
3. user789 - 321 requests ($1.69)
4. user012 - 234 requests ($1.23)
5. user345 - 198 requests ($1.04)

**Most Common Commands**:
1. "Create sticky note" - 2,345 requests
2. "Move object" - 1,234 requests
3. "Delete object" - 876 requests

**Recommendations**:
- Consider caching for "Create sticky note" commands (70% cache hit rate potential)
- Implement batch operations for multi-step commands
```

---

## Break-Even Analysis

### Freemium Model

**Assumptions**:
- Free tier: No AI access
- Paid tier: $5/month per user, unlimited AI (within reason)

**Break-even**:
- Cost per user: $0.11/month (Scenario 3)
- Revenue per user: $5/month
- **Margin**: $4.89/user/month (97.8%)

**Conclusion**: AI costs are negligible compared to subscription revenue.

---

### Usage-Based Model

**Assumptions**:
- Free tier: 10 AI requests/month
- Pay-as-you-go: $0.10 per AI request

**Break-even**:
- Cost per request: $0.00525
- Revenue per request: $0.10
- **Margin**: $0.0948/request (94.8%)

**Conclusion**: Highly profitable, but may limit adoption.

---

## Actual Spend Tracking

### February 2026

| Date | Service | Requests | Tokens (In/Out) | Cost | Notes |
|------|---------|----------|-----------------|------|-------|
| - | - | 0 | 0 / 0 | $0.00 | Not deployed yet |

**Month Total**: $0.00

---

### March 2026

| Date | Service | Requests | Tokens (In/Out) | Cost | Notes |
|------|---------|----------|-----------------|------|-------|
| - | - | - | - | - | - |

**Month Total**: $0.00

---

## Cost Optimization Experiments

### Experiment 1: Prompt Caching Impact

**Hypothesis**: Prompt caching reduces costs by 50-70%

**Setup**:
- Run 100 AI requests without caching
- Run 100 AI requests with caching (system prompt + tool definitions)
- Compare costs

**Results**:
- Not run yet

---

### Experiment 2: Model Selection (Sonnet vs Haiku)

**Hypothesis**: Haiku can handle 80% of commands at 75% lower cost

**Setup**:
- Classify commands as "simple" or "complex"
- Route simple → Haiku, complex → Sonnet
- Compare accuracy and cost

**Results**:
- Not run yet

---

## Budget & Alerts

### Monthly Budget: $0 (Not Set)

**Alert Thresholds**:
- 🟡 50% ($0) - Review usage patterns
- 🟠 80% ($0) - Consider optimizations
- 🔴 100% ($0) - Disable AI or increase budget

**Current Status**: 🟢 0% of budget used

---

## ROI Analysis

### Customer Lifetime Value (CLTV)

**Assumptions**:
- Average subscription: $5/month
- Average retention: 12 months
- **CLTV**: $60

### AI Cost per Customer

**Assumptions**:
- Average AI requests: 10/month
- Cost per request: $0.00525
- **AI cost per customer (12 months)**: $0.63

### ROI

**CLTV / AI Cost**: $60 / $0.63 = **95x ROI**

**Conclusion**: AI is a strong value-add with minimal cost impact.

---

## Appendix: Cost Calculation Formulas

### Claude API Cost

```
Input Cost = (Input Tokens / 1,000,000) * $3.00
Output Cost = (Output Tokens / 1,000,000) * $15.00
Total Cost = Input Cost + Output Cost
```

### Cloud Functions Cost

```
Invocation Cost = (Invocations / 1,000,000) * $0.40
Compute Cost = (Duration in seconds) * (Memory in GB) * $0.0000167
Network Cost = (Egress in GB) * $0.12
Total Cost = Invocation Cost + Compute Cost + Network Cost
```

### Firestore Cost

```
Storage Cost = (GB stored) * $0.18
Read Cost = (Reads / 100,000) * $0.06
Write Cost = (Writes / 100,000) * $0.18
Total Cost = Storage Cost + Read Cost + Write Cost
```

---

**Last Updated**: 2026-02-16
**Document Owner**: Finance & Engineering Teams
**Next Review**: End of Month (when AI is deployed)
