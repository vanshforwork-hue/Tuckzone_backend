import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  User,
  Mail,
  Lock,
  Phone,
  Hash,
  BookOpen,
  Layers,
  Users,
  KeyRound,
  Loader2,
  UserPlus,
  AlertCircle,
} from 'lucide-react';
import { registerAdmin, registerParent, registerStudent, registerTeacher } from '../api/auth';
import { apiErrorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import PasswordInput from '../components/PasswordInput';
import toast from 'react-hot-toast';
import './RegisterPage.css';

export default function RegisterPage() {
  const [role, setRole] = useState('STUDENT');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const navigate = useNavigate();
  const location = useLocation();
  const { registerStudentWithFirebase, registerTeacherWithFirebase, registerParentWithFirebase } = useAuth();

  // Arrives here from LoginPage's Phone tab when a verified Firebase identity has no
  // matching account yet — this identity already proved ownership of the number, so no
  // password is collected and the account is created + signed in directly on submit.
  const firebaseIdToken = location.state?.firebaseIdToken ?? null;
  // Only true for the Firebase-EMAIL flow: that email was itself the verified identity, so
  // changing it here would no longer match what Firebase proved — the backend rejects a
  // mismatch (FirebaseAccountService.newFirebaseUser). The phone flow's email is just
  // profile data (unverified either way), so it stays editable there.
  const emailLocked = Boolean(location.state?.emailLocked);

  const [formData, setFormData] = useState({
    fullName: '',
    email: location.state?.email ?? '',
    mobile: location.state?.mobile ?? '',
    password: '',
    admissionNumber: '',
    studentClass: '',
    section: '',
    rollNumber: '',
    parentMobile: '',
    employeeId: '',
    department: '',
    signupCode: '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    if (errors[name]) {
      setErrors({ ...errors, [name]: null });
    }
  };

  const validate = () => {
    const errs = {};

    if (!formData.fullName.trim()) {
      errs.fullName = 'Full name is required';
    } else if (formData.fullName.trim().length < 2) {
      errs.fullName = 'Name must be at least 2 characters';
    }

    if (!formData.email.trim()) {
      errs.email = 'Email address is required';
    } else if (!/^\S+@\S+\.\S+$/.test(formData.email)) {
      errs.email = 'Enter a valid email address';
    }

    // Mobile Number validation: must be digits only and exactly 10 digits
    if (!formData.mobile.trim()) {
      errs.mobile = 'Mobile number is required';
    } else if (!/^\d{10}$/.test(formData.mobile.trim())) {
      errs.mobile = 'Mobile number must be exactly 10 digits';
    }

    if (!firebaseIdToken) {
      if (!formData.password) {
        errs.password = 'Password is required';
      } else if (formData.password.length < 8) {
        errs.password = 'Password must be at least 8 characters';
      }
    }

    if (role === 'STUDENT') {
      if (!formData.admissionNumber.trim()) {
        errs.admissionNumber = 'Admission number is required';
      }

      if (formData.parentMobile.trim() && !/^\d{10}$/.test(formData.parentMobile.trim())) {
        errs.parentMobile = "Parent's mobile number must be exactly 10 digits";
      }

      if (!formData.studentClass.trim()) {
        errs.studentClass = 'Class is required';
      }

      if (!formData.section.trim()) {
        errs.section = 'Section is required';
      }

      if (!formData.rollNumber.trim()) {
        errs.rollNumber = 'Roll number is required';
      } else if (!/^\d+$/.test(formData.rollNumber.trim())) {
        errs.rollNumber = 'Roll number must be numeric';
      }
    }

    if (role === 'TEACHER') {
      if (!formData.employeeId.trim()) {
        errs.employeeId = 'Employee ID is required';
      }
      if (!formData.department.trim()) {
        errs.department = 'Department is required';
      }
    }

    if (role === 'ADMIN') {
      if (!formData.signupCode.trim()) {
        errs.signupCode = 'Canteen signup code is required';
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) {
      toast.error('Please fix all fields highlighted in red');
      return;
    }

    try {
      setLoading(true);

      if (firebaseIdToken) {
        // Identity already verified by Firebase — this creates the account and signs the
        // user in immediately, same shape of response as a normal login.
        const base = { idToken: firebaseIdToken, fullName: formData.fullName, email: formData.email, mobile: formData.mobile };
        const res = role === 'STUDENT'
          ? await registerStudentWithFirebase({
              ...base,
              admissionNumber: formData.admissionNumber,
              studentClass: formData.studentClass,
              section: formData.section,
              rollNumber: formData.rollNumber,
              parentMobile: formData.parentMobile.trim() || undefined,
            })
          : role === 'TEACHER'
            ? await registerTeacherWithFirebase({
                ...base,
                employeeId: formData.employeeId,
                department: formData.department,
              })
            : await registerParentWithFirebase(base);

        toast.success(`Welcome, ${res.user.fullName?.split(' ')[0]}!`);
        navigate(res.user.role === 'CANTEEN_ADMIN' ? '/admin/dashboard'
          : res.user.role === 'SUB_ADMIN' ? '/subadmin/orders' : '/menu');
        return;
      }

      if (role === 'STUDENT') {
        await registerStudent({
          fullName: formData.fullName,
          email: formData.email,
          mobile: formData.mobile,
          password: formData.password,
          admissionNumber: formData.admissionNumber,
          studentClass: formData.studentClass,
          section: formData.section,
          rollNumber: formData.rollNumber,
          parentMobile: formData.parentMobile.trim() || undefined,
        });
      } else if (role === 'TEACHER') {
        await registerTeacher({
          fullName: formData.fullName,
          email: formData.email,
          mobile: formData.mobile,
          password: formData.password,
          employeeId: formData.employeeId,
          department: formData.department,
        });
      } else if (role === 'ADMIN') {
        await registerAdmin({
          fullName: formData.fullName,
          email: formData.email,
          mobile: formData.mobile,
          password: formData.password,
          signupCode: formData.signupCode,
        });
      } else {
        await registerParent({
          fullName: formData.fullName,
          email: formData.email,
          mobile: formData.mobile,
          password: formData.password,
        });
      }

      toast.success('Account created! Enter the code we emailed you to finish.');
      navigate('/verify-email', { state: { email: formData.email } });
    } catch (error) {
      // The backend validates more than this form does, so a rejection can name a field we
      // never checked. Previously only the top-level message survived — the user saw
      // "Validation failed" with nothing marked and no way to tell which input was wrong.
      const fieldErrors = error.response?.data?.fieldErrors;
      if (fieldErrors && Object.keys(fieldErrors).length > 0) {
        setErrors(fieldErrors);
        toast.error(Object.values(fieldErrors)[0]);
      } else {
        toast.error(apiErrorMessage(error, 'Registration failed'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-container">
      <div className="register-card-wrapper">
        <div className="register-header">
          <div className="brand-logo">
            <UserPlus size={28} className="text-amber" />
          </div>
          <h1>Create Account</h1>
          <p>
            {firebaseIdToken
              ? 'Your identity is verified — just a few more details to finish setting up your account.'
              : 'Fill in your details to register with TuckZone'}
          </p>
        </div>

        <div className="role-tabs">
          <button
            className={`role-tab ${role === 'STUDENT' ? 'active' : ''}`}
            onClick={() => {
              setRole('STUDENT');
              setErrors({});
            }}
            type="button"
          >
            Student
          </button>
          <button
            className={`role-tab ${role === 'TEACHER' ? 'active' : ''}`}
            onClick={() => {
              setRole('TEACHER');
              setErrors({});
            }}
            type="button"
          >
            Teacher
          </button>
          <button
            className={`role-tab ${role === 'PARENT' ? 'active' : ''}`}
            onClick={() => {
              setRole('PARENT');
              setErrors({});
            }}
            type="button"
          >
            Parent
          </button>
          {/* Canteen/admin self-registration stays on the invite-code + password path
              only — a Firebase-verified identity isn't sufficient for admin access. */}
          {!firebaseIdToken && (
            <button
              className={`role-tab ${role === 'ADMIN' ? 'active' : ''}`}
              onClick={() => {
                setRole('ADMIN');
                setErrors({});
              }}
              type="button"
            >
              Canteen
            </button>
          )}
        </div>

        <form className="register-form" onSubmit={handleSubmit} noValidate>
          <div className="form-row">
            <div className="form-group">
              <label>Full Name<span className="required-mark">*</span></label>
              <div className="input-with-icon">
                <User className="input-icon" size={20} />
                <input
                  type="text"
                  name="fullName"
                  placeholder="John Doe"
                  value={formData.fullName}
                  onChange={handleChange}
                  className={errors.fullName ? 'input-error' : ''}
                />
              </div>
              {errors.fullName && (
                <span className="field-error-text">
                  <AlertCircle size={14} /> {errors.fullName}
                </span>
              )}
            </div>

            <div className="form-group">
              <label>Email Address<span className="required-mark">*</span></label>
              <div className="input-with-icon">
                <Mail className="input-icon" size={20} />
                <input
                  type="email"
                  name="email"
                  placeholder="john@example.com"
                  value={formData.email}
                  onChange={handleChange}
                  className={errors.email ? 'input-error' : ''}
                  disabled={emailLocked}
                  readOnly={emailLocked}
                />
              </div>
              {emailLocked && (
                <span className="field-error-text" style={{ color: 'inherit', opacity: 0.7 }}>
                  Verified with Firebase — can&apos;t be changed here
                </span>
              )}
              {errors.email && (
                <span className="field-error-text">
                  <AlertCircle size={14} /> {errors.email}
                </span>
              )}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>{role === 'STUDENT' ? 'Login Mobile (10 digits)' : 'Mobile Number (10 digits)'}<span className="required-mark">*</span></label>
              <div className="input-with-icon">
                <Phone className="input-icon" size={20} />
                <input
                  type="tel"
                  name="mobile"
                  maxLength={10}
                  placeholder="9876543210"
                  value={formData.mobile}
                  onChange={handleChange}
                  className={errors.mobile ? 'input-error' : ''}
                />
              </div>
              {errors.mobile && (
                <span className="field-error-text">
                  <AlertCircle size={14} /> {errors.mobile}
                </span>
              )}
            </div>

            <div className="form-group">
              {firebaseIdToken ? null : (
                <>
                  <label>Password<span className="required-mark">*</span></label>
                  <PasswordInput
                    icon={Lock}
                    iconSize={20}
                    name="password"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={handleChange}
                    className={errors.password ? 'input-error' : ''}
                  />
                  {errors.password && (
                    <span className="field-error-text">
                      <AlertCircle size={14} /> {errors.password}
                    </span>
                  )}
                </>
              )}
            </div>
          </div>

          {role === 'STUDENT' && (
            <>
              <div className="form-row">
                <div className="form-group">
                  <label>Admission Number<span className="required-mark">*</span></label>
                  <div className="input-with-icon">
                    <Hash className="input-icon" size={20} />
                    <input
                      type="text"
                      name="admissionNumber"
                      placeholder="Admission Number"
                      value={formData.admissionNumber}
                      onChange={handleChange}
                      className={errors.admissionNumber ? 'input-error' : ''}
                    />
                  </div>
                  {errors.admissionNumber && (
                    <span className="field-error-text">
                      <AlertCircle size={14} /> {errors.admissionNumber}
                    </span>
                  )}
                </div>

                <div className="form-group">
                  <label>Parent Mobile (10 digits, optional)</label>
                  <div className="input-with-icon">
                    <Phone className="input-icon" size={20} />
                    <input
                      type="tel"
                      name="parentMobile"
                      maxLength={10}
                      placeholder="Parent's 10-digit number"
                      value={formData.parentMobile}
                      onChange={handleChange}
                      className={errors.parentMobile ? 'input-error' : ''}
                    />
                  </div>
                  {errors.parentMobile && (
                    <span className="field-error-text">
                      <AlertCircle size={14} /> {errors.parentMobile}
                    </span>
                  )}
                </div>
              </div>

              <div className="form-row triple">
                <div className="form-group">
                  <label>Class<span className="required-mark">*</span></label>
                  <div className="input-with-icon">
                    <BookOpen className="input-icon" size={20} />
                    <input
                      type="text"
                      name="studentClass"
                      placeholder="10"
                      value={formData.studentClass}
                      onChange={handleChange}
                      className={errors.studentClass ? 'input-error' : ''}
                    />
                  </div>
                  {errors.studentClass && (
                    <span className="field-error-text">
                      <AlertCircle size={14} /> {errors.studentClass}
                    </span>
                  )}
                </div>

                <div className="form-group">
                  <label>Section<span className="required-mark">*</span></label>
                  <div className="input-with-icon">
                    <Layers className="input-icon" size={20} />
                    <input
                      type="text"
                      name="section"
                      placeholder="A"
                      value={formData.section}
                      onChange={handleChange}
                      className={errors.section ? 'input-error' : ''}
                    />
                  </div>
                  {errors.section && (
                    <span className="field-error-text">
                      <AlertCircle size={14} /> {errors.section}
                    </span>
                  )}
                </div>

                <div className="form-group">
                  <label>Roll No.<span className="required-mark">*</span></label>
                  <div className="input-with-icon">
                    <Hash className="input-icon" size={20} />
                    <input
                      type="text"
                      name="rollNumber"
                      placeholder="42"
                      value={formData.rollNumber}
                      onChange={handleChange}
                      className={errors.rollNumber ? 'input-error' : ''}
                    />
                  </div>
                  {errors.rollNumber && (
                    <span className="field-error-text">
                      <AlertCircle size={14} /> {errors.rollNumber}
                    </span>
                  )}
                </div>
              </div>
            </>
          )}

          {role === 'TEACHER' && (
            <div className="form-row">
              <div className="form-group">
                <label>Employee ID<span className="required-mark">*</span></label>
                <div className="input-with-icon">
                  <Hash className="input-icon" size={20} />
                  <input
                    type="text"
                    name="employeeId"
                    placeholder="Employee ID"
                    value={formData.employeeId}
                    onChange={handleChange}
                    className={errors.employeeId ? 'input-error' : ''}
                  />
                </div>
                {errors.employeeId && (
                  <span className="field-error-text">
                    <AlertCircle size={14} /> {errors.employeeId}
                  </span>
                )}
              </div>

              <div className="form-group">
                <label>Department<span className="required-mark">*</span></label>
                <div className="input-with-icon">
                  <Users className="input-icon" size={20} />
                  <input
                    type="text"
                    name="department"
                    placeholder="Science"
                    value={formData.department}
                    onChange={handleChange}
                    className={errors.department ? 'input-error' : ''}
                  />
                </div>
                {errors.department && (
                  <span className="field-error-text">
                    <AlertCircle size={14} /> {errors.department}
                  </span>
                )}
              </div>
            </div>
          )}

          {role === 'ADMIN' && (
            <div className="form-row">
              <div className="form-group" style={{ flex: 1 }}>
                <label>Canteen Signup Code<span className="required-mark">*</span></label>
                <div className="input-with-icon">
                  <KeyRound className="input-icon" size={20} />
                  <input
                    type="text"
                    name="signupCode"
                    placeholder="Ask whoever set up TuckZone"
                    value={formData.signupCode}
                    onChange={handleChange}
                    className={errors.signupCode ? 'input-error' : ''}
                  />
                </div>
                {errors.signupCode && (
                  <span className="field-error-text">
                    <AlertCircle size={14} /> {errors.signupCode}
                  </span>
                )}
                <span className="field-hint">
                  Whoever set up TuckZone for your school chose this code when installing
                  the server. Ask them for it — it is what stops anyone from giving
                  themselves canteen access.
                </span>
              </div>
            </div>
          )}

          <div className="form-actions mt-4">
            <button type="submit" className="btn-pill btn-pill-primary" disabled={loading}>
              {loading ? <Loader2 className="spinner" size={20} /> : <UserPlus size={20} />}
              <span>Register</span>
            </button>
          </div>
        </form>

        <div className="login-footer">
          <p>Already have an account? <Link to="/login" className="link-amber">Sign in here</Link></p>
        </div>
      </div>
    </div>
  );
}
