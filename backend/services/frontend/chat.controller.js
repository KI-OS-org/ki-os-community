/**
 * (c) 2026 KI-OS.org (v6.0) by Ingo Schaffer und Kimba
 * Datei: chat.controller.js
 * Diese Datei enthält JavaScript-Logik für Runtime, Services, Tools oder Tests innerhalb des KI-OS AgentMesh.
 */

const Kernel = require('../../core/kernel'); // Der neue Chef

class ChatController {
    async handleRequest(req, res) {
        const { message, userId, systemOverride } = req.body;
        if(!message) return res.status(400).json({error: "Empty"});

        try {
            // Unify: Nutze exakt den gleichen Kernel wie Lambda
            const payload = {
                query: message,
                userId: userId,
                tenantId: req.body.tenantId || 'default',
                intent: 'auto' // Lass den Kernel/KCU entscheiden
            };
            
            const result = await Kernel.executeRequest(payload, {});
            
            // Mapping für Frontend-Kompatibilität (KI3.php erwartet 'content')
            if (!result.success) return res.status(500).json({ content: "Error: " + result.error, type: 'error' });
            
            return res.json({
                content: result.content,
                meta: result.meta
            });

        } catch(e) { 
            return res.status(500).json({content: "System Error: "+e.message, type:'error'}); 
        }
    }
}
module.exports = new ChatController();