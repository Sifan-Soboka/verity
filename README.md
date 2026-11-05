# Verity – Financial Decisions, Made Clearer

**Verity** is a student project developed for CSIT305. It is an interactive web application that helps users understand how different financial factors can affect a loan decision.

The idea behind Verity is simple: instead of only showing whether a loan application is approved or rejected, we want users to understand *why* that decision was made.

## About the Project

Loan decisions can sometimes be difficult for customers to understand. Applicants may receive a decision without having a clear explanation of which financial factors influenced the result.

We developed Verity to make this process easier to understand through a simple interface that explains how factors such as income, debt-to-income ratio, and credit score affect a simulated loan decision.

This project is designed for learning and demonstration purposes. It does not represent the actual policies of any bank or financial institution.

## What Can You Do With Verity?

- **Try a loan assessment:** Enter financial details such as monthly income, debt-to-income ratio, and credit score.
- **View the result:** See whether your application is approved or rejected according to the project's decision rules.
- **Understand the decision:** View explanations showing how each financial factor contributed to the result.
- **Explore previous assessments:** Review earlier applications through the dashboard.
- **Compare different situations:** Change the financial details and see how the result changes.

## How Does It Work?

Verity uses a scoring system created for this project.

When a user submits their financial information, the application calculates a score based on three main factors:

1. **Monthly income:** The applicant's monthly income.
2. **Debt-to-income ratio (DTI):** The percentage of income used to pay existing debts.
3. **Credit score:** A numerical value used in the simulation to represent credit history.

The application combines these factors to produce a result and provides an explanation of how they influenced the decision.

The scoring rules are predefined by our project team. This is not a trained machine learning model, and the explanations are not generated using SHAP or LIME.

## Technologies Used

We used the following technologies to develop Verity:

| Technology | Purpose |
|---|---|
| Next.js | Building the website |
| React | Creating the user interface |
| TypeScript | Writing and organising the application code |
| Tailwind CSS | Styling the website |
| Prisma | Working with the database |
| SQLite | Storing application records |

## Running the Project Locally

If you want to run Verity on your computer, follow these steps.

### 1. Requirements

Make sure you have:

- Node.js (version 22.13 or later)
- npm
- Git

### 2. Download the Project

Clone the repository:

```bash
git clone https://github.com/Sifan-Soboka/verity.git
```

Open the project folder:

```bash
cd verity
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Set Up Environment Variables

Create a `.env` file using the example provided:

```bash
cp .env.example .env
```

On Windows PowerShell, you can use:

```powershell
Copy-Item .env.example .env
```

### 5. Set Up the Database

```bash
npm run db:setup
```

### 6. Start the Website

```bash
npm run dev
```

Open your browser and visit:

```text
http://localhost:3000
```

## Project Limitations

There are a few things worth keeping in mind:

- Verity is an educational simulation, not a real loan approval platform.
- It does not connect to banks or access real customer financial records.
- The decision-making process uses predefined scoring rules rather than a trained AI model.
- The explanations show the contributions defined by our scoring system; they are not SHAP or LIME explanations.
- The results should not be used to make real financial decisions.

## Our Goal

Through Verity, we aim to demonstrate how financial decision-making systems can become easier to understand by providing clear explanations alongside their results.

**Verity – Financial decisions, made clearer.**

---

*Developed as part of the CSIT305 university project.*
