// =============================================
// SOLAR WORK v4.1 - REST API ENDPOINTS
// =============================================
// Vercel Serverless Function pro Worker Management

// CORS headers pro všechny odpovědi
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

export default async function handler(req, res) {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).json({ success: true });
    }
    
    // Set CORS headers
    Object.entries(corsHeaders).forEach(([key, value]) => {
        res.setHeader(key, value);
    });
    
    try {
        switch (req.method) {
            case 'GET':
                return handleGetWorkers(req, res);
            case 'POST':
                return handleCreateWorker(req, res);
            case 'PUT':
                return handleUpdateWorker(req, res);
            case 'DELETE':
                return handleDeleteWorker(req, res);
            default:
                return res.status(405).json({
                    success: false,
                    error: 'Method not allowed',
                    allowedMethods: ['GET', 'POST', 'PUT', 'DELETE']
                });
        }
    } catch (error) {
        console.error('Worker API Error:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message
        });
    }
}

// GET /api/worker - List all workers
function handleGetWorkers(req, res) {
    // V reálné implementaci by se četlo z databáze
    // Pro demo vracíme příklad dat
    const workers = [
        {
            id: 'worker-demo-1',
            name: 'Jan Novák',
            code: '001',
            hourlyRate: 12.50,
            color: '#ef4444',
            createdAt: '2024-10-28T08:00:00.000Z'
        },
        {
            id: 'worker-demo-2', 
            name: 'Marie Svobodová',
            code: '002',
            hourlyRate: 15.00,
            color: '#22c55e',
            createdAt: '2024-10-28T08:00:00.000Z'
        }
    ];
    
    return res.status(200).json({
        success: true,
        message: 'Workers retrieved successfully',
        data: workers,
        count: workers.length
    });
}

// POST /api/worker - Create new worker
function handleCreateWorker(req, res) {
    const { name, code, hourlyRate, color } = req.body;
    
    // Validace
    if (!name || !name.trim()) {
        return res.status(400).json({
            success: false,
            error: 'Validation failed',
            message: 'Jméno pracovníka je povinné'
        });
    }
    
    if (!hourlyRate || hourlyRate < 0) {
        return res.status(400).json({
            success: false,
            error: 'Validation failed',
            message: 'Hodinová sazba musí být kladné číslo'
        });
    }
    
    // V reálné implementaci by se uložilo do databáze
    const newWorker = {
        id: 'worker-' + Date.now(),
        name: name.trim(),
        code: code?.trim() || '',
        hourlyRate: parseFloat(hourlyRate),
        color: color || '#3b82f6',
        createdAt: new Date().toISOString()
    };
    
    return res.status(201).json({
        success: true,
        message: `Pracovník ${newWorker.name} vytvořen úspěšně`,
        data: newWorker
    });
}

// PUT /api/worker - Update worker
function handleUpdateWorker(req, res) {
    const { id, name, code, hourlyRate, color } = req.body;
    
    if (!id) {
        return res.status(400).json({
            success: false,
            error: 'Validation failed',
            message: 'ID pracovníka je povinné'
        });
    }
    
    // V reálné implementaci by se aktualizovalo v databázi
    const updatedWorker = {
        id: id,
        name: name?.trim() || 'Unknown',
        code: code?.trim() || '',
        hourlyRate: parseFloat(hourlyRate) || 0,
        color: color || '#3b82f6',
        updatedAt: new Date().toISOString()
    };
    
    return res.status(200).json({
        success: true,
        message: `Pracovník ${updatedWorker.name} aktualizován`,
        data: updatedWorker
    });
}

// DELETE /api/worker - Delete worker
function handleDeleteWorker(req, res) {
    const { id } = req.query;
    
    if (!id) {
        return res.status(400).json({
            success: false,
            error: 'Validation failed',
            message: 'ID pracovníka je povinné'
        });
    }
    
    // V reálné implementaci by se smazalo z databáze
    return res.status(200).json({
        success: true,
        message: `Pracovník s ID ${id} smazán`,
        data: { deletedId: id }
    });
}