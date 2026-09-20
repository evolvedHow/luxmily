# Personal Inflation Index (PII)

## Functional Requirements for Implementation

Change how the personalized CPI is being calculated to make it more robust.  If needed, create a separate tab for the user to tune their CPI.  IF you think it will complicate this code, I don't mind creating a separate module for this but many of the data points around budgeting are the same.
Build the  personal inflation index  that allows an individual to create a customized inflation index based on official U.S. CPI data from the Bureau of Labor Statistics (BLS), while independently defining the individual's own consumption categories, spending weights, expense mappings, and inflation scenarios.

Note: The term" system" below simply refers to this functionality; not a separate system.  I'd prefer that we enhance Luxmily app unless there's a compellin reason to sepatate them.
---

# 1. Core Objective

The system must answer:

> "What is my personal inflation rate, based on the things I actually spend money on?"

The system should use official BLS CPI data as the underlying measure of price changes, but allow the user to override the national CPI expenditure weights with their own personal weights.

The system must distinguish between:

1. Official BLS CPI data
2. BLS category structure and metadata
3. User-defined expense categories
4. User-defined weights
5. User-to-BLS category mappings
6. Historical personal inflation calculations
7. Forward-looking inflation assumptions
8. Multiple personal scenarios

These components must remain logically independent.

---

# 2. Fundamental Design Principle

The BLS data is the **reference price dataset**.

The user's profile is the **personal weighting and consumption dataset**.

Do not modify BLS data when the user changes their personal profile.

A change to:

* personal spending
* personal weights
* category mappings
* retirement assumptions
* inflation assumptions
* scenarios

must never modify or overwrite the underlying BLS reference data.

Likewise, a BLS data update must not unexpectedly alter an existing personal profile.

Historical calculations should be reproducible.

---

# 3. BLS Reference Data

The system must maintain a BLS CPI reference dataset.

The system should support:

* CPI-U
* U.S. city average
* CPI index values
* CPI category hierarchy
* CPI series identifiers
* category descriptions
* historical monthly observations
* relative importance data where available
* expenditure/cost-weight information where available
* BLS weight/version periods

The system should preserve the BLS series ID as the fundamental identifier for a CPI series.

Do not rely solely on category names.

Each BLS series should have metadata such as:

* series ID
* name
* description
* parent category
* hierarchy level
* geographic scope
* population scope
* frequency
* effective period
* source
* last update date

---

# 4. BLS Data Loader

Provide a functional mechanism for loading and updating BLS data.

The loader must be independent from personal profiles and personal calculations.

The loader should:

1. Discover or retrieve the supported CPI series.
2. Retrieve historical observations.
3. Retrieve relevant category metadata.
4. Retrieve relative importance/weight information where appropriate.
5. Detect new BLS observations.
6. Add new observations without destroying historical observations.
7. Preserve the source/version associated with each dataset.
8. Record when the dataset was loaded.
9. Detect missing or anomalous data.
10. Avoid creating duplicate observations.

The system should support repeated updates.

Running the BLS loader multiple times should be safe.

---

# 5. Historical Integrity

Historical BLS data must remain identifiable by its source/version/time period.

The system must not silently rewrite historical personal calculations because a newer BLS weight structure becomes available.

For example:

```text
BLS 2025 reference data
BLS 2026 reference data
BLS 2027 reference data
```

should be treated as distinct reference periods when necessary.

The system must preserve enough information to reproduce a previous calculation.

---

# 6. CPI Category Hierarchy

Represent the BLS CPI hierarchy as a navigable hierarchy.

For example:

```text
Food
  Food at home
    Cereals
    Meats
    Dairy
    Fruits and vegetables
  Food away from home

Housing
  Shelter
    Rent
    Owners' equivalent rent
  Utilities
  Household furnishings

Transportation
  New vehicles
  Used vehicles
  Motor fuel
  Motor vehicle insurance
  Maintenance and repair

Medical Care
  Medical care services
  Hospital services
  Physician services
  Prescription drugs
```

The actual hierarchy must come from BLS data rather than being hard-coded based on this example.

The system should allow the user to inspect the hierarchy and select the level of granularity appropriate for their model.

---

# 7. Personal Expense Categories

Allow the user to create their own categories.

These categories do not have to match BLS categories.

Example:

```text
My Healthcare
My Housing
My Travel
My Food
My Transportation
My Insurance
My Entertainment
My Taxes
My Other Spending
```

A personal category may map to:

* one BLS series
* multiple BLS series
* a parent BLS category
* multiple subcategories with different weights

---

# 8. Personal Expense Mapping

The user must be able to map personal expenses to BLS CPI series.

Example:

```text
Expense:
Prescription drugs

Maps to:
BLS Prescription Drugs CPI
```

Another example:

```text
Expense:
Healthcare

Components:
  Hospital      40%
  Physicians    25%
  Drugs         20%
  Dental        15%
```

The system must support hierarchical mappings.

A personal category can therefore contain subcategories.

---

# 9. Personal Weights

The user must be able to define personal weights.

Weights must sum to 100%.

Weights may be specified at:

* top-level category
* subcategory
* expense level

The system should validate weights.

For example:

```text
Housing       20%
Healthcare    25%
Food          10%
Transportation 10%
Travel        15%
Utilities      5%
Insurance      5%
Other         10%

Total        100%
```

The system must prevent invalid configurations or clearly identify them.

---

# 10. Spending-Based Weight Generation

Provide an option to generate weights from actual spending.

The user should be able to enter:

```text
Category
Annual spending
```

and have the system calculate:

```text
Weight = Category Spending / Total Spending
```

The user should be able to edit the resulting weights afterward.

The system should distinguish between:

### Actual spending weights

Based on historical spending.

### Planned spending weights

Based on expected future spending.

### Custom weights

Explicitly specified by the user.

---

# 11. Multiple Personal Profiles

The user must be able to create multiple profiles.

Examples:

```text
Current Lifestyle
Retirement Baseline
Retirement Conservative
Healthcare Heavy
Travel Heavy
Minimalist
```

Each profile should have its own:

* categories
* mappings
* weights
* assumptions
* scenarios

Profiles must be independent.

Changing one profile must not change another.

---

# 12. Fixed vs Variable Expenses

Each personal expense/category should optionally be classified as:

* Fixed
* Variable
* Semi-variable
* Contractual
* Discretionary

This classification should not directly change CPI calculations unless the user chooses to incorporate it into a budget-inflation model.

The purpose is to distinguish:

> "The price of this category increased"

from:

> "My actual cash expenditure increased."

---

# 13. Personal CPI Calculation

The core calculation is:

```text
Personal Inflation =
SUM(
    Personal Weight × Relevant CPI Inflation
)
```

For each category:

```text
Category Contribution =
Personal Weight × Category Inflation
```

The system must calculate:

* monthly personal inflation
* 1-month change
* 3-month change
* 6-month change
* 12-month change
* 24-month change
* 3-year annualized inflation
* 5-year annualized inflation
* other configurable periods

Where possible, calculate these from the underlying CPI index rather than relying solely on published inflation percentages.

---

# 14. Personal Inflation Index

Create an actual index value.

The user should be able to select a base period.

Example:

```text
January 2020 = 100
```

The system then constructs:

```text
Jan 2020    100.0
Jan 2021    102.1
Jan 2022    107.4
Jan 2023    113.2
...
```

The personal inflation index must use the user's weighting profile.

The user should be able to change the base period.

---

# 15. Official CPI Comparison

Always provide an optional comparison between:

```text
Official CPI
vs
Personal CPI
```

Example:

```text
                    Personal       Official

12 months              4.1%          3.4%
3 years                3.8%          3.5%
5 years                4.0%          3.7%
```

The system must clearly identify which population, geography, and period the official CPI represents.

Do not imply that the two measures are identical concepts.

---

# 16. Category Contribution Analysis

For every personal inflation calculation, show how much each category contributed.

Example:

```text
Healthcare       +1.35%
Housing          +0.80%
Travel           +0.50%
Insurance        +0.30%
Food             +0.25%
Transportation   +0.20%
Other            +0.20%

Total            +3.60%
```

The contribution must be calculated from:

```text
weight × category inflation
```

The user should be able to sort contributions from largest to smallest.

---

# 17. Inflation Drivers

Provide a clear answer to:

> "What is driving my inflation?"

The system should identify categories with the largest positive contribution.

It should also identify categories reducing overall personal inflation.

Example:

```text
Largest inflation contributors:
1. Healthcare
2. Housing
3. Insurance

Categories below overall inflation:
Food
Transportation
Recreation
```

Do not simply rank categories by inflation rate.

Rank or sort them by their **contribution to the user's overall inflation**, because a small category with very high inflation may have less impact than a large category with moderate inflation.

---

# 18. User-Defined Scenario Modeling

Allow the user to create scenarios.

Examples:

```text
Baseline
Healthcare Stress
Housing Stress
High Travel
Low Spending
```

A scenario should be able to modify:

* category weights
* BLS inflation assumptions
* spending
* fixed/variable classifications
* future inflation assumptions

The original profile must remain unchanged.

---

# 19. Forward-Looking Inflation

Support user-defined future inflation assumptions.

For example:

```text
Healthcare       6.0%
Housing          3.0%
Food             2.5%
Travel           4.0%
Insurance        5.0%
```

Calculate:

```text
Expected Personal Inflation
```

from these assumptions.

Do not assume that future inflation equals historical inflation.

Historical BLS data and future assumptions are separate concepts.

---

# 20. Scenario Sensitivity

Allow the user to ask:

> "What happens to my personal inflation if healthcare inflation increases from 5% to 8%?"

The system should show:

```text
Baseline personal inflation       3.9%
Healthcare assumption             5.0%

New personal inflation            4.7%
Healthcare contribution            +X.X%
```

The user should be able to vary assumptions interactively.

---

# 21. Budget Inflation

Provide a separate concept called:

## Budget Inflation

Budget Inflation should answer:

> "How much more money will I actually need to maintain my lifestyle?"

This should be distinct from Personal CPI.

For example, an expense may have:

```text
CPI inflation = 5%
```

but the user's actual expenditure may not rise by 5% because the expense is fixed or contractually constrained.

The system should therefore support a separate budget model.

---

# 22. Personal Consumption Inflation vs Budget Inflation

The system should clearly distinguish:

### Personal Consumption Inflation

Measures price changes in the user's consumption basket.

### Personal Budget Inflation

Measures the expected change in the user's actual spending requirement.

Do not combine these into a single metric.

Both should be available.

---

# 23. Spending Forecast

Given:

```text
Current annual spending
Personal inflation
```

project future spending.

Example:

```text
Current spending       $150,000

Year 1                 $156,000
Year 5                 $183,000
Year 10                $222,000
Year 20                $332,000
```

Allow the user to choose:

* inflation rate
* inflation profile
* scenario
* time horizon

---

# 24. Retirement-Oriented Analysis

The system should support a retirement-oriented view.

Allow the user to compare:

```text
Portfolio income growth
vs
Personal inflation
```

Example:

```text
Portfolio income growth       3.0%
Personal inflation            4.1%

Real income change            -1.1%
```

This is an analytical comparison only.

Do not provide investment advice.

---

# 25. Historical Analysis

Allow the user to select any historical period supported by the BLS data.

Examples:

```text
2000–2010
2010–2020
2020–2026
Last 5 years
Last 10 years
```

Calculate the user's personal inflation for that period using the selected personal profile.

---

# 26. Weight Stability

Support two conceptual approaches.

### Fixed-weight historical analysis

Use today's personal weights to ask:

> "How would my current lifestyle have experienced inflation historically?"

### Historical-weight analysis

Use historical personal spending weights if the user provides them.

The system must clearly identify which methodology is being used.

---

# 27. Personal Spending History

Allow the user to optionally enter or import historical spending.

For example:

```text
Year       Housing    Healthcare    Food    Travel
2022       ...
2023       ...
2024       ...
2025       ...
```

Use this to calculate historical personal weights.

The user should be able to override automatically calculated weights.

---

# 28. Category Overrides

Allow a user to override a BLS category with a more specific personal assumption.

Example:

```text
BLS:
Healthcare inflation = 5.5%

User:
My healthcare inflation = 7.0%
```

The system should clearly identify the source:

```text
BLS-derived
or
User override
```

Do not silently replace BLS data.

---

# 29. Mixed BLS/User Calculations

A profile can contain both:

```text
BLS-derived inflation
```

and:

```text
User-defined inflation
```

Example:

```text
Housing          BLS
Healthcare       User assumption
Food             BLS
Travel           User assumption
Transportation   BLS
```

The resulting personal index should disclose the mixture.

---

# 30. Data Provenance

Every calculated result should be traceable.

The user should be able to determine:

```text
Personal Category
      ↓
BLS Series
      ↓
BLS Observation
      ↓
Calculation Period
      ↓
Personal Weight
      ↓
Contribution
      ↓
Final Personal Inflation
```

The system should make this information available when the user drills into a result.

---

# 31. Calculation Audit Trail

For important calculations, provide an explanation such as:

```text
Healthcare

Personal weight:       25%
BLS inflation:          5.5%

Contribution:

25% × 5.5%
= 1.375 percentage points
```

This should make the system understandable rather than functioning as a black box.

---

# 32. Dashboard

The primary dashboard should show:

### Personal Inflation

```text
3.9%
```

### Official CPI

```text
3.4%
```

### Difference

```text
+0.5 percentage points
```

### Largest contributors

```text
Healthcare
Housing
Travel
```

### Personal CPI Index

Chart over time.

### Official vs Personal CPI

Comparison chart.

### Category contributions

Contribution chart.

---

# 33. Category Drilldown

Clicking a category should show:

```text
Healthcare

Personal weight
Current inflation
Historical inflation
Contribution
BLS series
Underlying components
Historical chart
```

If healthcare has subcategories, allow further drilldown.

---

# 34. Weight Editor

Provide a dedicated interface for editing weights.

The user should be able to:

* enter percentages
* enter dollar spending
* switch between percentage and spending views
* add categories
* remove categories
* reorder categories
* create subcategories
* map categories to BLS series
* see the total immediately

The interface should clearly show:

```text
Total Weight: 97.5%

WARNING:
Weights must equal 100%.
```

---

# 35. Scenario Comparison

Allow multiple scenarios to be compared.

Example:

```text
                    Baseline   Healthcare Stress   Travel Heavy

Personal CPI           3.9%          4.5%              4.1%
Budget inflation       3.7%          4.4%              4.0%
```

The system should not overwrite scenarios when comparing them.

---

# 36. Export

Allow the user to export:

* personal profiles
* weights
* mappings
* historical CPI
* personal CPI calculations
* scenario assumptions
* scenario results
* spending data
* calculation results

The exported data should retain enough information to reproduce the calculation.

---

# 37. Configuration Independence

Separate the following concepts:

```text
BLS Reference Data
BLS Taxonomy
Personal Profiles
Personal Expenses
Personal Weights
Personal Mappings
Historical Calculations
Future Assumptions
Scenarios
```

Do not combine them into one mutable structure.

---

# 38. Versioning

Personal profiles should be versionable.

For example:

```text
Retirement Profile v1
Retirement Profile v2
Retirement Profile v3
```

If a user changes their weights in 2027, the system should not retroactively change calculations performed using the 2026 profile unless explicitly requested.

---

# 39. Reproducibility

A historical result should be reproducible.

If the user views:

```text
Personal inflation for 2025
```

the result should be based on:

* the selected profile/version
* the selected BLS data
* the selected BLS series
* the applicable weights
* the calculation methodology

Do not allow today's configuration to silently rewrite historical results.

---

# 40. Methodology Disclosure

Every personal index should display its methodology.

For example:

```text
Personal Inflation Index

Source:
BLS CPI-U, U.S. City Average

Weighting:
User-defined

Profile:
Retirement Baseline v3

Calculation:
Weighted average of component CPI inflation

Base period:
January 2020 = 100

Historical weights:
Current profile weights
```

The exact methodology should always be visible.

---

# 41. Important Conceptual Distinctions

The system must explicitly distinguish:

### CPI

Official government measure.

### Personal CPI

Official price indexes combined using the user's consumption weights.

### Personal Budget Inflation

Expected change in the user's actual spending requirement.

### Forecast Inflation

User-defined assumptions about future inflation.

### Scenario Inflation

Inflation resulting from a particular set of assumptions.

These are related but should not be treated as interchangeable.

---

# 42. Handling Categories Without a Perfect BLS Match

Not every personal expense will have an exact BLS equivalent.

The system should allow:

1. Exact BLS mapping
2. Closest BLS mapping
3. Composite mapping
4. User-defined inflation
5. Exclusion from the CPI calculation

The user must be able to see which method is being used.

---

# 43. Taxes and Non-Consumption Items

The system should allow categories such as:

```text
Federal income tax
State income tax
Property tax
Charitable giving
Investment contributions
Debt principal
Savings
```

but should distinguish them from consumption.

These items generally should **not automatically be treated as CPI components**.

Instead, support an optional separate:

## Personal Cash-Flow Inflation / Budget Model

This allows the user to model their actual cash requirements without pretending that every cash-flow item represents consumer-price inflation.

---

# 44. Healthcare Special Handling

Healthcare should support unusually detailed modeling.

Allow:

```text
Health insurance
Medicare premiums
Supplemental insurance
Prescription drugs
Physicians
Hospital
Dental
Vision
Long-term care
Out-of-pocket medical expenses
```

Each can have its own BLS mapping or user-defined assumption.

This is important because healthcare can represent a substantially different inflation experience for different households.

---

# 45. Housing Special Handling

Housing should support:

```text
Rent
Mortgage
Property tax
Home insurance
HOA
Utilities
Maintenance
Repairs
Renovations
```

The system should distinguish between:

* market price inflation
* actual household expenditure
* fixed contractual payments

where applicable.

---

# 46. Travel Special Handling

Travel should support components such as:

```text
Airfare
Hotels
Rental cars
Restaurants
Cruises
International travel
Domestic travel
```

The user should be able to assign different weights and assumptions.

---

# 47. Insurance Special Handling

Support:

```text
Health insurance
Home insurance
Auto insurance
Umbrella insurance
Other insurance
```

where BLS series exist.

Allow user-defined inflation where an appropriate BLS series does not exist.

---

# 48. User Experience Principle

The system should be understandable by a financially sophisticated individual without requiring them to understand the technical details of CPI construction.

The user should primarily interact with concepts such as:

```text
What do I spend?
What categories matter to me?
How much does each category matter?
What BLS measure represents that category?
What happens if inflation changes?
```

Technical details should be available through drilldown rather than forced upon the user.

---

# 49. Default Profile

Create a default profile based on broad CPI categories.

This profile is only a starting point.

The user should be encouraged to customize it.

The system should make it obvious that:

> "Your Personal CPI is only as good as the consumption weights and mappings you provide."

---

# 50. Validation Requirements

Validate:

* weights
* missing BLS mappings
* duplicate mappings
* invalid series IDs
* missing observations
* unsupported periods
* inconsistent hierarchy
* negative spending
* zero total spending
* invalid scenarios
* incomplete profiles

Errors should be understandable to a normal user.

---

# 51. No Silent Assumptions

The system must not silently:

* substitute a different BLS series
* change personal weights
* change historical weights
* change profile versions
* replace user assumptions with BLS values
* extrapolate missing data without disclosure

Whenever an assumption is made, identify it.

---

# 52. Advanced Analytics

Once the core functionality works, support:

### Inflation decomposition

Break personal inflation into category contributions.

### Inflation attribution

Explain why personal inflation differs from official CPI.

### Historical percentile

Show whether current personal inflation is unusually high relative to the selected historical period.

### Volatility

Calculate volatility of each category and of the overall Personal CPI.

### Inflation concentration

Show how much of total inflation comes from the largest categories.

Example:

```text
Top 3 categories account for 68% of personal inflation.
```

### Scenario sensitivity

Show which categories have the greatest impact on overall personal inflation.

---

# 53. Core Outputs

At minimum, the system must produce:

1. Current Personal Inflation Rate
2. Personal Inflation Index
3. Official CPI comparison
4. Category-level inflation
5. Category contribution
6. Personal weights
7. Historical personal inflation
8. Future inflation scenarios
9. Personal spending projections
10. Budget inflation
11. Scenario comparisons
12. Calculation provenance

---

# 54. Example End-to-End User Journey

A new user should be able to:

### Step 1

Create:

```text
Retirement Baseline
```

### Step 2

Select major categories:

```text
Housing
Healthcare
Food
Transportation
Travel
Insurance
Entertainment
Other
```

### Step 3

Enter annual spending.

### Step 4

System calculates weights.

### Step 5

User adjusts weights.

### Step 6

System suggests BLS mappings.

### Step 7

User confirms mappings.

### Step 8

System calculates:

```text
My Personal Inflation = X.X%
```

### Step 9

System explains:

```text
Healthcare contributes X.X%
Housing contributes X.X%
...
```

### Step 10

User creates:

```text
Healthcare Stress
```

and changes healthcare inflation.

### Step 11

System calculates the new personal inflation.

### Step 12

User projects future spending over 5, 10, 20 years.

---

# 55. Acceptance Criteria

The implementation should not be considered complete unless a user can independently:

* load/update BLS CPI data
* browse BLS categories
* create a personal profile
* create personal categories
* map categories to BLS series
* assign personal weights
* generate weights from spending
* save multiple profiles
* calculate personal inflation
* calculate a personal CPI index
* view category contributions
* compare personal CPI with official CPI
* view historical personal inflation
* define future inflation assumptions
* create scenarios
* compare scenarios
* calculate budget inflation
* project future spending
* inspect calculation provenance
* preserve historical profile versions
* reproduce previous calculations

---

# 56. Guiding Principle

The system should ultimately answer four different questions:

### 1. What is happening?

> What is inflation according to BLS?

### 2. What is happening to me?

> What is inflation for my personal consumption basket?

### 3. What is likely to happen to me?

> What might my personal inflation rate be in the future?

### 4. What does that mean for my finances?

> How much will I need to spend to maintain my lifestyle?

Keep these four questions conceptually separate.

The resulting product should be a **personal inflation measurement and scenario-analysis system**, not simply a CPI calculator.

The architecture should allow the BLS reference data to evolve independently while personal profiles, historical calculations, and future scenarios remain stable and reproducible.

Do not over-engineer the initial user experience. Build the core data, weighting, mapping, calculation, historical analysis, and scenario capabilities first, then add advanced analytics and visualization.
