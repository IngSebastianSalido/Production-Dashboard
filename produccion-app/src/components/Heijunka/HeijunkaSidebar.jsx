import React, { useState } from 'react';
import './HeijunkaSidebar.css';

const HeijunkaSidebar = ({
  batches,
  maintenanceBlocks,
  setupBlocks,
  selectedDay,
  weekStart,
  onAddBatch,
  onRemoveBatch,
  onMoveBatch,
  onAddMaintenance,
  onRemoveMaintenance,
  onAddSetup,
  onRemoveSetup,
  onClearSchedule
}) => {
  const [activeTab, setActiveTab] = useState('batches');
  
  // Batch form state
  const [batchForm, setBatchForm] = useState({
    pn: '',
    quantity: '',
    hourRate: ''
  });

  // Maintenance form state
  const [maintenanceForm, setMaintenanceForm] = useState({
    time: '12:00',
    duration: '1',
    dayDate: selectedDay
  });

  // Setup form state
  const [setupForm, setSetupForm] = useState({
    time: '12:00',
    duration: '1',
    dayDate: selectedDay
  });

  // Keep day pickers in sync with selected day
  React.useEffect(() => {
    setMaintenanceForm((prev) => ({ ...prev, dayDate: selectedDay }));
    setSetupForm((prev) => ({ ...prev, dayDate: selectedDay }));
  }, [selectedDay]);

  const handleAddBatch = () => {
    if (batchForm.pn && batchForm.quantity && batchForm.hourRate) {
      onAddBatch(
        batchForm.pn,
        parseInt(batchForm.quantity),
        parseFloat(batchForm.hourRate)
      );
      setBatchForm({ pn: '', quantity: '', hourRate: '' });
    }
  };

  const handleAddMaintenance = () => {
    if (maintenanceForm.time && maintenanceForm.duration) {
      onAddMaintenance(
        maintenanceForm.time,
        parseInt(maintenanceForm.duration),
        maintenanceForm.dayDate
      );
      setMaintenanceForm({ time: '12:00', duration: '1', dayDate: selectedDay });
    }
  };

  const handleAddSetup = () => {
    if (setupForm.time && setupForm.duration) {
      onAddSetup(
        setupForm.time,
        parseInt(setupForm.duration),
        setupForm.dayDate
      );
      setSetupForm({ time: '12:00', duration: '1', dayDate: selectedDay });
    }
  };

  return (
    <div className="heijunka-sidebar">
      <div className="sidebar-tabs">
        <button
          className={`tab-button ${activeTab === 'batches' ? 'active' : ''}`}
          onClick={() => setActiveTab('batches')}
        >
          Production Batches
        </button>
        <button
          className={`tab-button ${activeTab === 'maintenance' ? 'active' : ''}`}
          onClick={() => setActiveTab('maintenance')}
        >
          Maintenance
        </button>
        <button
          className={`tab-button ${activeTab === 'setup' ? 'active' : ''}`}
          onClick={() => setActiveTab('setup')}
        >
          Setup/Tooling
        </button>
      </div>

      <div className="sidebar-content">
        {/* Batches Tab */}
        {activeTab === 'batches' && (
          <div className="tab-content">
            <div className="form-section">
              <h3>Add Production Batch</h3>
              
              <div className="form-group">
                <label>Part Number (PN)</label>
                <input
                  type="text"
                  placeholder="e.g., PN-12345"
                  value={batchForm.pn}
                  onChange={(e) => setBatchForm({ ...batchForm, pn: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Quantity (pcs)</label>
                <input
                  type="number"
                  placeholder="0"
                  value={batchForm.quantity}
                  onChange={(e) => setBatchForm({ ...batchForm, quantity: e.target.value })}
                  min="1"
                />
              </div>

              <div className="form-group">
                <label>Hour Rate (pcs/hour)</label>
                <input
                  type="number"
                  placeholder="0.0"
                  value={batchForm.hourRate}
                  onChange={(e) => setBatchForm({ ...batchForm, hourRate: e.target.value })}
                  min="0.1"
                  step="0.1"
                />
              </div>

              <button className="btn-add" onClick={handleAddBatch}>
                + Add Batch
              </button>

              <div className="info-box">
                <p>Batches will be scheduled sequentially based on their hour rate. After one batch completes, the next one will start automatically.</p>
              </div>
            </div>

            <div className="list-section">
              <h3>Scheduled Batches</h3>
              {batches.length === 0 ? (
                <p className="empty-message">No batches added yet</p>
              ) : (
                <div className="batch-list">
                  {batches.map((batch, idx) => {
                    const hoursRequired = batch.quantity / batch.hourRate;
                    return (
                      <div key={batch.id} className="batch-item">
                        <div className="batch-header">
                          <span className="batch-number">#{idx + 1}</span>
                          <span className="batch-pn">{batch.pn}</span>
                          <div className="batch-actions">
                            <button
                              className="btn-move"
                              onClick={() => onMoveBatch(batch.id, 'up')}
                              disabled={idx === 0}
                              title="Move up"
                            >
                              ↑
                            </button>
                            <button
                              className="btn-move"
                              onClick={() => onMoveBatch(batch.id, 'down')}
                              disabled={idx === batches.length - 1}
                              title="Move down"
                            >
                              ↓
                            </button>
                            <button
                              className="btn-remove"
                              onClick={() => onRemoveBatch(batch.id)}
                              title="Remove batch"
                            >
                              ×
                            </button>
                          </div>
                        </div>
                        <div className="batch-details">
                          <div className="detail">
                            <span className="label">Qty:</span>
                            <span className="value">{batch.quantity} pcs</span>
                          </div>
                          <div className="detail">
                            <span className="label">Rate:</span>
                            <span className="value">{batch.hourRate} pcs/h</span>
                          </div>
                          <div className="detail">
                            <span className="label">Time:</span>
                            <span className="value">{hoursRequired.toFixed(2)} h</span>
                          </div>
                          <div className="detail">
                            <span className="label">Day start:</span>
                            <span className="value">{selectedDay}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Maintenance Tab */}
        {activeTab === 'maintenance' && (
          <div className="tab-content">
            <div className="form-section">
              <h3>Schedule Maintenance</h3>

              <div className="form-group">
                <label>Day</label>
                <input
                  type="date"
                  value={maintenanceForm.dayDate}
                  onChange={(e) => setMaintenanceForm({ ...maintenanceForm, dayDate: e.target.value })}
                  min={weekStart}
                />
              </div>

              <div className="form-group">
                <label>Start Time</label>
                <input
                  type="time"
                  value={maintenanceForm.time}
                  onChange={(e) => setMaintenanceForm({ ...maintenanceForm, time: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Duration (hours)</label>
                <input
                  type="number"
                  placeholder="1"
                  value={maintenanceForm.duration}
                  onChange={(e) => setMaintenanceForm({ ...maintenanceForm, duration: e.target.value })}
                  min="1"
                  max="24"
                />
              </div>

              <button className="btn-add" onClick={handleAddMaintenance}>
                + Add Maintenance
              </button>

              <div className="info-box">
                <p>Maintenance blocks will prevent production during the scheduled time.</p>
              </div>
            </div>

            <div className="list-section">
              <h3>Maintenance Schedule</h3>
              {maintenanceBlocks.length === 0 ? (
                <p className="empty-message">No maintenance scheduled</p>
              ) : (
                <div className="block-list">
                  {maintenanceBlocks.map((maint) => (
                    <div key={maint.id} className="block-item maintenance">
                      <div className="block-header">
                        <span className="block-type">Maintenance</span>
                        <button
                          className="btn-remove"
                          onClick={() => onRemoveMaintenance(maint.id)}
                          title="Remove maintenance"
                        >
                          ×
                        </button>
                      </div>
                      <div className="block-details">
                        <div className="detail">
                          <span className="label">Time:</span>
                          <span className="value">{maint.time}</span>
                        </div>
                        <div className="detail">
                          <span className="label">Duration:</span>
                          <span className="value">{maint.duration} h</span>
                        </div>
                        <div className="detail">
                          <span className="label">Day:</span>
                          <span className="value">{maint.dayDate || selectedDay}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Setup Tab */}
        {activeTab === 'setup' && (
          <div className="tab-content">
            <div className="form-section">
              <h3>Schedule Setup/Tooling</h3>

              <div className="form-group">
                <label>Day</label>
                <input
                  type="date"
                  value={setupForm.dayDate}
                  onChange={(e) => setSetupForm({ ...setupForm, dayDate: e.target.value })}
                  min={weekStart}
                />
              </div>

              <div className="form-group">
                <label>Start Time</label>
                <input
                  type="time"
                  value={setupForm.time}
                  onChange={(e) => setSetupForm({ ...setupForm, time: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Duration (hours)</label>
                <input
                  type="number"
                  placeholder="1"
                  value={setupForm.duration}
                  onChange={(e) => setSetupForm({ ...setupForm, duration: e.target.value })}
                  min="1"
                  max="24"
                />
              </div>

              <button className="btn-add" onClick={handleAddSetup}>
                + Add Setup
              </button>

              <div className="info-box">
                <p>Setup blocks will reserve time for tooling changes or equipment configuration.</p>
              </div>
            </div>

            <div className="list-section">
              <h3>Setup Schedule</h3>
              {setupBlocks.length === 0 ? (
                <p className="empty-message">No setup scheduled</p>
              ) : (
                <div className="block-list">
                  {setupBlocks.map((setup) => (
                    <div key={setup.id} className="block-item setup">
                      <div className="block-header">
                        <span className="block-type">Setup/Tooling</span>
                        <button
                          className="btn-remove"
                          onClick={() => onRemoveSetup(setup.id)}
                          title="Remove setup"
                        >
                          ×
                        </button>
                      </div>
                      <div className="block-details">
                        <div className="detail">
                          <span className="label">Time:</span>
                          <span className="value">{setup.time}</span>
                        </div>
                        <div className="detail">
                          <span className="label">Duration:</span>
                          <span className="value">{setup.duration} h</span>
                        </div>
                        <div className="detail">
                          <span className="label">Day:</span>
                          <span className="value">{setup.dayDate || selectedDay}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Clear Button */}
        {(batches.length > 0 || maintenanceBlocks.length > 0 || setupBlocks.length > 0) && (
          <div className="action-buttons">
            <button className="btn-clear" onClick={onClearSchedule}>
              Clear All Schedule
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default HeijunkaSidebar;
