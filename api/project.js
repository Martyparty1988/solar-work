// =============================================
// SOLAR WORK v4.1 - PROJECT API ENDPOINT
// =============================================

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') {
        return res.status(200).json({ success: true });
    }
    
    Object.entries(corsHeaders).forEach(([key, value]) => {
        res.setHeader(key, value);
    });
    
    try {
        switch (req.method) {
            case 'GET':
                return handleGetProjects(req, res);
            case 'POST':
                return handleCreateProject(req, res);
            case 'PUT':
                return handleUpdateProject(req, res);
            case 'DELETE':
                return handleDeleteProject(req, res);
            default:
                return res.status(405).json({
                    success: false,
                    error: 'Method not allowed'
                });
        }
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message
        });
    }
}

function handleGetProjects(req, res) {
    const projects = [
        {
            id: 'proj-demo-1',
            jmenoProjektu: 'Demo Projekt A',
            createdAt: '2024-10-28T08:00:00.000Z',
            hasPDF: true,
            estimatedTables: 150
        },
        {
            id: 'proj-demo-2',
            jmenoProjektu: 'Demo Projekt B', 
            createdAt: '2024-10-28T08:00:00.000Z',
            hasPDF: false,
            estimatedTables: 75
        }
    ];
    
    return res.status(200).json({
        success: true,
        message: 'Projects retrieved successfully',
        data: projects,
        count: projects.length
    });
}

function handleCreateProject(req, res) {
    const { name, estimatedTables } = req.body;
    
    if (!name || !name.trim()) {
        return res.status(400).json({
            success: false,
            error: 'Validation failed',
            message: 'Název projektu je povinný'
        });
    }
    
    const newProject = {
        id: 'proj-' + Date.now(),
        jmenoProjektu: name.trim(),
        estimatedTables: estimatedTables || 0,
        hasPDF: false,
        createdAt: new Date().toISOString()
    };
    
    return res.status(201).json({
        success: true,
        message: `Projekt ${newProject.jmenoProjektu} vytvořen`,
        data: newProject
    });
}

function handleUpdateProject(req, res) {
    const { id, name, estimatedTables } = req.body;
    
    if (!id) {
        return res.status(400).json({
            success: false,
            error: 'Validation failed',
            message: 'ID projektu je povinné'
        });
    }
    
    const updatedProject = {
        id: id,
        jmenoProjektu: name?.trim() || 'Untitled Project',
        estimatedTables: estimatedTables || 0,
        updatedAt: new Date().toISOString()
    };
    
    return res.status(200).json({
        success: true,
        message: `Projekt ${updatedProject.jmenoProjektu} aktualizován`,
        data: updatedProject
    });
}

function handleDeleteProject(req, res) {
    const { id } = req.query;
    
    if (!id) {
        return res.status(400).json({
            success: false,
            error: 'Validation failed',
            message: 'ID projektu je povinné'
        });
    }
    
    return res.status(200).json({
        success: true,
        message: `Projekt s ID ${id} smazán`,
        data: { deletedId: id }
    });
}