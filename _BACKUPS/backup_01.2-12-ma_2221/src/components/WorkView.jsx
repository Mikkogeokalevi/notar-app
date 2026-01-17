import React, { useState } from 'react';

const WorkView = ({ availableTasks }) => {
    const [valittuTehtava, setValittuTehtava] = useState(null);

    if (valittuTehtava) {
        return (
            <div>
                <button onClick={() => setValittuTehtava(null)} className="back-btn" style={{marginBottom:'20px'}}>&larr; Takaisin</button>
                <h2>{valittuTehtava.label}</h2>
                <p>Tähän tulee lista kohteista (Firestore-haku)...</p>
            </div>
        )
    }

    return (
        <div>
            <h2 style={{textAlign:'center', marginBottom:'20px'}}>Valitse työtehtävä:</h2>
            <div className="button-grid">
                {availableTasks.map(task => (
                    <button 
                        key={task.id} 
                        className="work-button" 
                        style={{backgroundColor: task.color || '#2196f3'}}
                        onClick={() => setValittuTehtava(task)}
                    >
                        {task.label}
                    </button>
                ))}
            </div>
            {availableTasks.length === 0 && <p style={{textAlign:'center'}}>Ei määriteltyjä työtehtäviä. Käy Toimistossa lisäämässä.</p>}
        </div>
    );
};

export default WorkView;