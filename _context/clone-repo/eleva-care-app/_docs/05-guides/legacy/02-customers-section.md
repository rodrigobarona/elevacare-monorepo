# Patients Section

## Overview

The Patients section provides experts with a centralized view of all their clients, allowing them to track patient interactions, appointment history, and payment details. This feature enhances the expert's ability to manage their client relationships and gain insights into patient engagement patterns.

## Components

### 1. Patient List Page (`/appointments/patients`)

The main patients page displays a table of all clients who have booked appointments with the expert. Key features include:

- **Search Functionality**: Filter patients by name or email address
- **Patient Statistics**: View appointment count and total spend for each patient
- **Quick Access**: Links to detailed patient profiles

### 2. Patient Detail Page (`/appointments/patients/[id]`)

The detail page provides comprehensive information about an individual patient:

- **Personal Information**: Name, email, and account creation date
- **Quick Stats**: Summary of appointments, revenue, and session information
- **Appointment History**: Complete list of past and upcoming appointments
- **Payment History**: Record of all payments made by the patient

## Data Architecture

The Patients section aggregates data from multiple sources:

1. **Meeting Data**: Patient appointments stored in the application database
2. **Stripe Data**: Payment information associated with patient bookings

Unlike a traditional e-commerce platform, our approach maintains the marketplace model where experts do not directly "own" patients in Stripe. Instead, patients belong to the Eleva Care platform, and payments are transferred to expert Connect accounts after processing.

## Technical Implementation

### API Endpoints

1. `/api/appointments/patients`
   - Returns a list of all patients who have booked with the current expert
   - Includes statistics about appointment count and total spend

2. `/api/appointments/patients/[email]`
   - Returns detailed information about a specific patient (identified by email)
   - Includes appointment history and payment records

### Data Flow

1. When a patient books an appointment:
   - A record is created in the MeetingTable with patient details
   - The payment is processed through Stripe using the platform's Stripe account
   - Funds are transferred to the expert's Connect account (minus platform fees)

2. In the Patients section:
   - The application groups appointments by patient email
   - Patient statistics are calculated from appointment data
   - Payment information is derived from the meeting records

## Benefits

1. **Centralized Client Management**: All patient information in one place
2. **Revenue Insights**: Track earnings by patient
3. **Relationship Management**: View complete history of interactions with each client

## Future Enhancements

Potential future improvements to the Patients section:

1. **Patient Notes**: Allow experts to add private notes about clients
2. **Communication History**: Track messages exchanged with clients
3. **Custom Fields**: Enable experts to add custom data fields for their patients
4. **Export Functionality**: Allow exporting patient data for external analysis
5. **Direct Stripe Integration**: Fetch payment details directly from Stripe API

## Security and Privacy

The Patients section adheres to these privacy principles:

1. Patient data is only visible to the expert who provided the service
2. Sensitive payment details (like full card numbers) are never stored or displayed
3. All patient data is handled in compliance with GDPR, HIPAA, and other privacy regulations
