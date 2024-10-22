const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const app = express();
const PORT = 3000;

app.use(bodyParser.json());

const db = new sqlite3.Database('./expenses.db');

app.post('/users', (req, res) => {
    const { name, email, mobile } = req.body;
    const query = `INSERT INTO users (name, email, mobile) VALUES (?, ?, ?)`;
    db.run(query, [name, email, mobile], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.status(201).json({ id: this.lastID, message: "User created successfully" });
    });
});

app.get('/users/:id', (req, res) => {
    const { id } = req.params;
    const query = `SELECT * FROM users WHERE id = ?`;
    db.get(query, [id], (err, row) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(row);
    });
});

app.post('/expenses', (req, res) => {
    const { user_id, description, amount, split_method, splits } = req.body;

    if (split_method === 'percentage') {
        const totalPercentage = splits.reduce((sum, split) => sum + split.percentage, 0);
        if (totalPercentage !== 100) {
            return res.status(400).json({ error: "Percentages must add up to 100" });
        }
    }

    const query = `INSERT INTO expenses (user_id, description, amount, split_method) VALUES (?, ?, ?, ?)`;
    db.run(query, [user_id, description, amount, split_method], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        const expense_id = this.lastID;

        splits.forEach(split => {
            let splitAmount;
            if (split_method === 'equal') {
                splitAmount = amount / splits.length;
            } else if (split_method === 'exact') {
                splitAmount = split.amount;
            } else if (split_method === 'percentage') {
                splitAmount = (split.percentage / 100) * amount;
            }

            const splitQuery = `INSERT INTO expense_splits (expense_id, participant_name, participant_email, split_amount) VALUES (?, ?, ?, ?)`;
            db.run(splitQuery, [expense_id, split.name, split.email, splitAmount]);
        });

        res.status(201).json({ id: expense_id, message: "Expense added successfully" });
    });
});

app.get('/expenses/:user_id', (req, res) => {
    const { user_id } = req.params;
    const query = `SELECT * FROM expenses WHERE user_id = ?`;
    db.all(query, [user_id], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

app.get('/expenses', (req, res) => {
    const query = `SELECT * FROM expenses`;
    db.all(query, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

app.get('/balance-sheet/download', (req, res) => {
    const query = `
        SELECT e.description, e.amount, s.participant_name, s.split_amount
        FROM expenses e
        JOIN expense_splits s ON e.id = s.expense_id
    `;
    db.all(query, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        let csvContent = 'Description,Amount,Participant,Split Amount\n';
        rows.forEach(row => {
            csvContent += `${row.description},${row.amount},${row.participant_name},${row.split_amount}\n`;
        });

        res.header('Content-Type', 'text/csv');
        res.attachment('balance-sheet.csv');
        res.send(csvContent);
    });
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
