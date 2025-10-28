// =============================================
// SOLAR WORK v4.1 - API DOCUMENTATION
// =============================================
// Vercel endpoint: /api/docs - JSON API documentation

export default function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');
    
    const apiDocs = {
        name: "Solar Work API v4.1",
        version: "4.1.0",
        description: "REST API pro řízení Solar Work aplikace - pracovníci, projekty, směny",
        baseUrl: "https://yourdomain.vercel.app/api",
        
        endpoints: {
            "/api/worker": {
                description: "Správa pracovníků",
                methods: {
                    "GET": {
                        description: "Získat seznam všech pracovníků",
                        parameters: {},
                        response: {
                            success: "boolean",
                            data: "array",
                            count: "number"
                        },
                        example: {
                            success: true,
                            data: [
                                {
                                    id: "worker-1234567890",
                                    name: "Jan Novák",
                                    code: "001",
                                    hourlyRate: 12.50,
                                    color: "#ef4444"
                                }
                            ],
                            count: 1
                        }
                    },
                    "POST": {
                        description: "Vytvořit nového pracovníka",
                        parameters: {
                            name: "string (povinné)",
                            code: "string (volitelné)", 
                            hourlyRate: "number (povinné)",
                            color: "string (volitelné, hex)"
                        },
                        response: {
                            success: "boolean",
                            data: "object",
                            message: "string"
                        },
                        example: {
                            success: true,
                            message: "Pracovník Jan Novák vytvořen úspěšně",
                            data: {
                                id: "worker-1234567890",
                                name: "Jan Novák",
                                code: "001",
                                hourlyRate: 12.50,
                                color: "#ef4444"
                            }
                        }
                    },
                    "PUT": {
                        description: "Aktualizovat existujícího pracovníka",
                        parameters: {
                            id: "string (povinné)",
                            name: "string (volitelné)",
                            code: "string (volitelné)",
                            hourlyRate: "number (volitelné)",
                            color: "string (volitelné)"
                        }
                    },
                    "DELETE": {
                        description: "Smazat pracovníka",
                        parameters: {
                            id: "string (query parameter)"
                        }
                    }
                }
            },
            
            "/api/project": {
                description: "Správa projektů",
                methods: {
                    "GET": {
                        description: "Získat seznam všech projektů",
                        parameters: {},
                        response: {
                            success: "boolean",
                            data: "array",
                            count: "number"
                        }
                    },
                    "POST": {
                        description: "Vytvořit nový projekt",
                        parameters: {
                            name: "string (povinné)",
                            estimatedTables: "number (volitelné)"
                        }
                    },
                    "PUT": {
                        description: "Aktualizovat projekt",
                        parameters: {
                            id: "string (povinné)",
                            name: "string (volitelné)",
                            estimatedTables: "number (volitelné)"
                        }
                    },
                    "DELETE": {
                        description: "Smazat projekt",
                        parameters: {
                            id: "string (query parameter)"
                        }
                    }
                }
            },
            
            "/api/shift": {
                description: "Správa směn (pro budoucí implementaci)",
                status: "planned",
                methods: {
                    "GET": {
                        description: "Získat aktivní směnu",
                        parameters: {
                            workerId: "string (volitelné)"
                        }
                    },
                    "POST": {
                        description: "Začít novou směnu",
                        parameters: {
                            workerId: "string (povinné)",
                            projectId: "string (volitelné)",
                            startTime: "ISO datetime (volitelné)"
                        }
                    },
                    "PUT": {
                        description: "Ukončit směnu",
                        parameters: {
                            shiftId: "string (povinné)",
                            endTime: "ISO datetime (volitelné)"
                        }
                    }
                }
            }
        },
        
        globalFunctions: {
            description: "Globální JavaScript funkce pro AI ovládání",
            namespace: "window.SolarWorkAPI",
            functions: {
                "addWorker(name, code, hourlyRate, color?)": {
                    description: "Přidat pracovníka",
                    returns: "Promise<{success, workerId, data}>",
                    example: "await SolarWorkAPI.addWorker('Karel', 'KA', 10.5)"
                },
                "startShift(workerId)": {
                    description: "Spustit časovač směny",
                    returns: "Promise<{success, workerId, startTime}>",
                    example: "await SolarWorkAPI.startShift('worker-123')"
                },
                "stopShift()": {
                    description: "Ukončit běžící směnu",
                    returns: "Promise<{success, data}>",
                    example: "await SolarWorkAPI.stopShift()"
                },
                "getWorkers()": {
                    description: "Získat všechny pracovníky",
                    returns: "Array<Worker>",
                    example: "const workers = SolarWorkAPI.getWorkers()"
                },
                "getProjects()": {
                    description: "Získat všechny projekty",
                    returns: "Array<Project>",
                    example: "const projects = SolarWorkAPI.getProjects()"
                },
                "getWorkEntries(filter?)": {
                    description: "Získat pracovní záznamy s filtrem",
                    returns: "Array<WorkEntry>",
                    parameters: {
                        filter: {
                            projectId: "string",
                            workerId: "string",
                            type: "'task' | 'hourly'",
                            dateFrom: "ISO datetime",
                            dateTo: "ISO datetime"
                        }
                    },
                    example: "const entries = SolarWorkAPI.getWorkEntries({type: 'task', projectId: 'proj-123'})"
                }
            },
            
            quickFunctions: {
                description: "Rychlé aliasy pro časté operace",
                functions: {
                    "startShift(workerId)": "Alias pro SolarWorkAPI.startShift",
                    "stopShift()": "Alias pro SolarWorkAPI.stopShift",
                    "addWorker(name, code, rate, color?)": "Alias pro SolarWorkAPI.addWorker",
                    "getWorkers()": "Alias pro SolarWorkAPI.getWorkers"
                }
            }
        },
        
        selectors: {
            description: "CSS selektory pro AI automaty",
            
            "Action Buttons": {
                "Start Shift": "#start-shift[data-action='start-shift']",
                "Stop Shift": "#stop-shift[data-action='stop-shift']",
                "Add Worker": "#add-new-worker[data-action='add-worker']",
                "Add Project": "#add-new-project[data-action='add-project']",
                "Generate Report": "#generate-report[data-action='generate-report']",
                "Export CSV": "#export-csv[data-action='export-csv']"
            },
            
            "Form Inputs": {
                "Worker Name": "#worker-name[data-field='worker-name']",
                "Worker Code": "#worker-code[data-field='worker-code']", 
                "Worker Rate": "#worker-rate[data-field='worker-rate']",
                "Project Name": "#project-name[data-field='project-name']",
                "Table Number": "#table-number[data-field='table-number']",
                "Reward Per Worker": "#reward-per-worker[data-field='reward-per-worker']"
            },
            
            "Selectors/Pickers": {
                "Project Picker": "#project-picker[data-role='picker']",
                "Worker Picker (Timer)": "#timer-worker[data-role='picker']",
                "Stats Worker Filter": "#stats-worker-filter[data-role='filter']",
                "Records Date Filter": "#records-date-filter[data-role='filter']"
            },
            
            "Data Display": {
                "Timer Display": "#timer-display[data-info='timer-display']",
                "Page Indicator": "#page-indicator[data-info='page-indicator']",
                "Records List": "#records-list[data-content='records-list']",
                "Workers List": "#workers-list[data-content='workers-list']",
                "Projects List": "#projects-list[data-content='projects-list']"
            },
            
            "Canvas/Plan": {
                "PDF Canvas": "#pdf-canvas[data-surface='plan']",
                "Worker Legend": "#worker-badges[data-info='worker-legend']"
            }
        },
        
        examples: {
            "Přidat pracovníka přes API": {
                method: "POST",
                url: "/api/worker",
                body: {
                    name: "Karel Dvořák",
                    code: "KD",
                    hourlyRate: 15.5,
                    color: "#22c55e"
                }
            },
            "Přidat pracovníka přes JS": {
                code: "await addWorker('Karel Dvořák', 'KD', 15.5, '#22c55e')"
            },
            "Spustit směnu": {
                code: "await startShift('worker-1234567890')"
            },
            "Získat data pro analytšy": {
                code: "const workers = getWorkers(); const entries = getWorkEntries({type: 'task'});"
            }
        },
        
        aiAutomation: {
            description: "Pokyny pro AI asistenty",
            quickStart: [
                "1. Otevřít appku a počkat na načtení",
                "2. V konzoli zapsat: SolarWorkAPI.enableAIMode()",
                "3. Použít globální funkce nebo querySelector na data-action prvky"
            ],
            
            commonTasks: {
                "Přidat nového pracovníka": {
                    jsFunction: "await addWorker('Jméno', 'Kód', 12.5)",
                    domMethod: "document.querySelector('#add-new-worker[data-action=\"add-worker\"]').click()"
                },
                "Začít směnu": {
                    jsFunction: "await startShift('worker-id')",
                    domMethod: "document.querySelector('#start-shift[data-action=\"start-shift\"]').click()"
                },
                "Filtrovat záznamy": {
                    domMethod: "document.querySelector('#records-filter[data-field=\"type\"]').value = 'task'"
                },
                "Navigace": {
                    jsFunction: "navigateTo('statistics')",
                    domMethod: "document.querySelector('[data-nav=\"statistics\"]').click()"
                }
            },
            
            dataAccess: {
                "Všichni pracovníci": "getWorkers()",
                "Všechny projekty": "getProjects()",
                "Záznamy dneška": "getWorkEntries({dateFrom: new Date().toISOString().split('T')[0]})",
                "Pouze stoly": "getWorkEntries({type: 'task'})",
                "Pouze hodiny": "getWorkEntries({type: 'hourly'})"
            }
        },
        
        status: {
            database: "IndexedDB (local)",
            storage: "localStorage (local)",
            apiEndpoints: "Active",
            aiSupport: "Full",
            version: "4.1.0"
        },
        
        contact: {
            author: "Marty Party",
            repository: "https://github.com/Martyparty1988/solar-work",
            email: "mullerfve@gmail.com"
        }
    };
    
    return res.status(200).json(apiDocs);
}