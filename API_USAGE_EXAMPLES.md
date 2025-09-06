# Enhanced Quarter Sheet API Usage Examples

## New Multi-Filter and Sorting Features

The `/mis/quarter-sheet` endpoint now supports:
- **Multiple values for each filter** (array support)
- **Sorting by any field** with ascending/descending order
- **Additional filter fields** for better data filtering

## API Usage Examples

### Basic Usage (unchanged)
```bash
GET /mis/quarter-sheet?page=1&page_size=50
```

### Multiple Filtering Examples

#### Filter by Multiple Agent Codes
```bash
GET /mis/quarter-sheet?agent_code=A001&agent_code=A002&agent_code=A003
```

#### Filter by Multiple States and Product Types
```bash
GET /mis/quarter-sheet?state=Maharashtra&state=Gujarat&product_type=Private Car&product_type=Two Wheeler
```

#### Complex Multi-Field Filtering
```bash
GET /mis/quarter-sheet?
  agent_code=A001&agent_code=A002&
  insurer_name=HDFC ERGO&insurer_name=ICICI Lombard&
  fuel_type=Petrol&fuel_type=Diesel&
  plan_type=Comprehensive&plan_type=STP
```

### Sorting Examples

#### Sort by Reporting Month (Ascending - default)
```bash
GET /mis/quarter-sheet?sort_by=reporting_month&sort_order=asc
```

#### Sort by Gross Premium (Descending)
```bash
GET /mis/quarter-sheet?sort_by=gross_premium&sort_order=desc
```

#### Sort by Agent Code (Ascending)
```bash
GET /mis/quarter-sheet?sort_by=agent_code
```

### Combined Filtering and Sorting

#### Filter Multiple Agents and Sort by Premium
```bash
GET /mis/quarter-sheet?
  agent_code=A001&agent_code=A002&
  sort_by=gross_premium&
  sort_order=desc
```

#### Filter by State and Product Type, Sort by Booking Date
```bash
GET /mis/quarter-sheet?
  state=Maharashtra&state=Gujarat&
  product_type=Private Car&
  sort_by=booking_date&
  sort_order=desc
```

## Available Filter Fields

All filter fields support multiple values:

### Basic Filters
- `agent_code` - Agent codes (e.g., A001, A002)
- `insurer_name` - Insurance company names
- `policy_number` - Policy numbers
- `reporting_month` - Reporting months (e.g., Jan'25, Feb'25)

### New Additional Filters
- `child_id` - Child/User IDs
- `broker_name` - Broker names
- `product_type` - Product types (Private Car, Two Wheeler, etc.)
- `plan_type` - Plan types (Comprehensive, STP, SAOD)

### Vehicle Filters
- `make_model` - Vehicle make and model
- `model` - Specific model names
- `gvw` - Gross Vehicle Weight values
- `rto` - RTO codes (MH01, DL01, etc.)
- `state` - State names
- `fuel_type` - Fuel types (Petrol, Diesel, CNG, Electric)
- `cc` - Engine capacity values
- `age_year` - Vehicle age in years

## Available Sort Fields

Sort by any field in the data:
- `reporting_month`
- `child_id`
- `agent_code`
- `insurer_name`
- `broker_name`
- `policy_number`
- `product_type`
- `plan_type`
- `make_model`
- `model`
- `gvw`
- `rto`
- `state`
- `fuel_type`
- `cc`
- `age_year`
- `gross_premium`
- `net_premium`
- `booking_date`
- `policy_start_date`
- `policy_end_date`

## Sort Orders
- `asc` - Ascending (default)
- `desc` - Descending

## Response Format (unchanged)

```json
{
  "records": [
    {
      "reporting_month": "Jan'25",
      "child_id": "USR001",
      "agent_code": "A001",
      "insurer_name": "HDFC ERGO",
      "policy_number": "POL123456",
      // ... all other fields
    }
  ],
  "total_count": 150,
  "page": 1,
  "page_size": 50,
  "total_pages": 3
}
```

## Performance Notes

- **Filtering**: Multiple values for each field use OR logic within the field, AND logic between fields
- **Sorting**: Applied after filtering but before pagination
- **Pagination**: Applied last for optimal performance
- **Search**: Still works with the `search` parameter across key fields
