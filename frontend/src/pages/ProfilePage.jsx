import React, { useState } from 'react';
import { Pencil, X, LogOut, AlertCircle, Loader2, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { updateMe, deleteMe } from '../api/auth';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import ConfirmDialog from '../components/ConfirmDialog';
import './ProfilePage.css';

function InfoRow({ label, value }) {
  return (
    <div className="info-row">
      <span className="info-label">{label}</span>
      <span className="info-value">{value || '—'}</span>
    </div>
  );
}

export default function ProfilePage() {
  const { user, refreshProfile, logout } = useAuth();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [formData, setFormData] = useState({
    fullName: user?.fullName ?? '',
    studentClass: user?.studentClass ?? '',
    section: user?.section ?? '',
    rollNumber: user?.rollNumber ?? '',
    seatNumber: user?.seatNumber ?? '',
    department: user?.department ?? '',
  });

  if (!user) return null;

  const startEditing = () => {
    setFormData({
      fullName: user.fullName ?? '',
      studentClass: user.studentClass ?? '',
      section: user.section ?? '',
      rollNumber: user.rollNumber ?? '',
      seatNumber: user.seatNumber ?? '',
      department: user.department ?? '',
    });
    setErrors({});
    setEditing(true);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    if (errors[name]) setErrors({ ...errors, [name]: null });
  };

  const validate = () => {
    const errs = {};
    if (!formData.fullName.trim()) errs.fullName = 'Full name is required';
    if (user.role === 'STUDENT') {
      if (!formData.studentClass.trim()) errs.studentClass = 'Class is required';
      if (!formData.section.trim()) errs.section = 'Section is required';
      if (!formData.rollNumber.trim()) errs.rollNumber = 'Roll number is required';
    }
    if (user.role === 'TEACHER' && !formData.department.trim()) {
      errs.department = 'Department is required';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!validate()) {
      toast.error('Please fix the fields highlighted in red');
      return;
    }
    try {
      setSaving(true);
      await updateMe({
        fullName: formData.fullName,
        studentClass: user.role === 'STUDENT' ? formData.studentClass : undefined,
        section: user.role === 'STUDENT' ? formData.section : undefined,
        rollNumber: user.role === 'STUDENT' ? formData.rollNumber : undefined,
        seatNumber: user.role === 'STUDENT' ? formData.seatNumber || undefined : undefined,
        department: user.role === 'TEACHER' ? formData.department : undefined,
      });
      await refreshProfile();
      setEditing(false);
      toast.success('Profile updated');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleDeleteAccount = async () => {
    try {
      setDeleting(true);
      await deleteMe();
      logout();
      navigate('/login');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not delete account');
      setDeleting(false);
      setConfirmingDelete(false);
    }
  };

  const initials = user.fullName?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || '?';

  return (
    <div className="profile-container">
      <div className="page-header profile-header-row">
        <div>
          <h1>My Profile</h1>
        </div>
        <button type="button" className="btn-ghost" onClick={() => (editing ? setEditing(false) : startEditing())}>
          {editing ? <X size={16} /> : <Pencil size={16} />}
          <span>{editing ? 'Cancel' : 'Edit'}</span>
        </button>
      </div>

      <div className="profile-avatar-section">
        <div className="profile-avatar">{initials}</div>
        <h2>{user.fullName}</h2>
        <span className="role-pill">{user.role?.replace('_', ' ')}</span>
      </div>

      {editing ? (
        <form className="card profile-edit-form" onSubmit={handleSave}>
          <div className="form-group">
            <label>Full Name</label>
            <input
              type="text"
              name="fullName"
              value={formData.fullName}
              onChange={handleChange}
              className={errors.fullName ? 'input-error' : ''}
            />
            {errors.fullName && (
              <span className="field-error-text"><AlertCircle size={14} /> {errors.fullName}</span>
            )}
          </div>

          {user.role === 'STUDENT' && (
            <>
              <div className="form-row triple">
                <div className="form-group">
                  <label>Class</label>
                  <input
                    type="text"
                    name="studentClass"
                    value={formData.studentClass}
                    onChange={handleChange}
                    className={errors.studentClass ? 'input-error' : ''}
                  />
                  {errors.studentClass && (
                    <span className="field-error-text"><AlertCircle size={14} /> {errors.studentClass}</span>
                  )}
                </div>
                <div className="form-group">
                  <label>Section</label>
                  <input
                    type="text"
                    name="section"
                    value={formData.section}
                    onChange={handleChange}
                    className={errors.section ? 'input-error' : ''}
                  />
                  {errors.section && (
                    <span className="field-error-text"><AlertCircle size={14} /> {errors.section}</span>
                  )}
                </div>
                <div className="form-group">
                  <label>Roll No.</label>
                  <input
                    type="text"
                    name="rollNumber"
                    value={formData.rollNumber}
                    onChange={handleChange}
                    className={errors.rollNumber ? 'input-error' : ''}
                  />
                  {errors.rollNumber && (
                    <span className="field-error-text"><AlertCircle size={14} /> {errors.rollNumber}</span>
                  )}
                </div>
              </div>
              <div className="form-group">
                <label>Seat No. (optional)</label>
                <input type="text" name="seatNumber" value={formData.seatNumber} onChange={handleChange} />
              </div>
            </>
          )}

          {user.role === 'TEACHER' && (
            <div className="form-group">
              <label>Department</label>
              <input
                type="text"
                name="department"
                value={formData.department}
                onChange={handleChange}
                className={errors.department ? 'input-error' : ''}
              />
              {errors.department && (
                <span className="field-error-text"><AlertCircle size={14} /> {errors.department}</span>
              )}
            </div>
          )}

          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? <Loader2 className="spinner" size={18} /> : null}
            <span>{saving ? 'Saving...' : 'Save Changes'}</span>
          </button>
        </form>
      ) : (
        <div className="card profile-info-card">
          <InfoRow label="Email" value={user.email} />
          <InfoRow label="Mobile" value={user.mobile} />
          {user.role === 'STUDENT' && (
            <>
              <InfoRow label="Admission No." value={user.admissionNumber} />
              <InfoRow label="Class" value={user.studentClass && user.section ? `${user.studentClass} - ${user.section}` : user.studentClass} />
              <InfoRow label="Roll No." value={user.rollNumber} />
              <InfoRow label="Seat No." value={user.seatNumber} />
            </>
          )}
          {user.role === 'TEACHER' && (
            <>
              <InfoRow label="Employee ID" value={user.employeeId} />
              <InfoRow label="Department" value={user.department} />
            </>
          )}
        </div>
      )}

      <button type="button" className="btn-secondary profile-logout-btn" onClick={handleLogout}>
        <LogOut size={18} />
        <span>Sign Out</span>
      </button>

      <button
        type="button"
        className="btn-danger profile-delete-btn"
        onClick={() => setConfirmingDelete(true)}
        disabled={deleting}
      >
        <Trash2 size={18} />
        <span>{deleting ? 'Deleting...' : 'Delete Account'}</span>
      </button>

      <ConfirmDialog
        open={confirmingDelete}
        title="Delete your account?"
        message="This can't be undone. Your name, email, and mobile number will be permanently removed. Past orders and wallet history are kept, but no longer linked to you."
        confirmLabel="Delete Account"
        onConfirm={handleDeleteAccount}
        onCancel={() => setConfirmingDelete(false)}
      />
    </div>
  );
}
