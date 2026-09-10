import React, { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, Power, RotateCcw, ChevronDown, ChevronRight, X, AlertCircle, UtensilsCrossed } from 'lucide-react';
import {
  activateMenuItem,
  createMenuItem,
  deleteMenuItem,
  getMenuItems,
  permanentlyDeleteMenuItem,
  removeMenuItemImage,
  updateMenuItem,
  uploadMenuItemImage,
} from '../../api/admin';
import toast from 'react-hot-toast';
import EmptyState from '../../components/EmptyState';
import ConfirmDialog from '../../components/ConfirmDialog';
import MenuActionDialog from '../../components/MenuActionDialog';
import ImageUploadField from '../../components/ImageUploadField';
import './FixedMenuPage.css';

const EMPTY_FORM = { name: '', description: '', price: '', available: true, allergens: '' };

export default function FixedMenuPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [errors, setErrors] = useState({});
  const [formData, setFormData] = useState(EMPTY_FORM);
  // Image is staged separately from the rest of the form — see ImageUploadField — and
  // only actually uploaded/removed after the item itself is saved.
  const [currentImageUrl, setCurrentImageUrl] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [imageRemoved, setImageRemoved] = useState(false);
  const [actionTarget, setActionTarget] = useState(null);
  const [permanentDeleteTarget, setPermanentDeleteTarget] = useState(null);
  const [showRetired, setShowRetired] = useState(false);

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      const data = await getMenuItems(true, 'FIXED');
      setItems(data);
    } catch (err) {
      toast.error('Failed to load Daily Delights items');
    } finally {
      setLoading(false);
    }
  };

  const validate = () => {
    const errs = {};
    if (!formData.name.trim()) {
      errs.name = 'Item name is required';
    }

    const priceNum = parseFloat(formData.price);
    if (!formData.price || isNaN(priceNum) || priceNum <= 0) {
      errs.price = 'Enter a valid price greater than ₹0';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) {
      toast.error('Please fix errors highlighted in red');
      return;
    }

    try {
      const payload = {
        ...formData,
        price: Number(formData.price).toFixed(2),
        menuType: 'FIXED',
      };

      const saved = editingId
        ? await updateMenuItem(editingId, payload)
        : await createMenuItem(payload);

      // The item itself is saved at this point regardless of what happens to its image —
      // an upload/removal failure here must not look like the whole save failed.
      if (imageFile) {
        try {
          await uploadMenuItemImage(saved.id, imageFile);
        } catch (imageErr) {
          toast.error(imageErr.response?.data?.message || 'Item saved, but the image upload failed');
        }
      } else if (imageRemoved) {
        await removeMenuItemImage(saved.id).catch(() => undefined);
      }

      toast.success(editingId ? 'Item updated' : 'Item created');
      setIsModalOpen(false);
      setErrors({});
      fetchItems();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed');
    }
  };

  const handleRetire = async () => {
    if (!actionTarget) return;
    try {
      await deleteMenuItem(actionTarget.id);
      toast.success('Item retired');
      setActionTarget(null);
      fetchItems();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not retire item');
    }
  };

  const handleRestore = async (item) => {
    try {
      await activateMenuItem(item.id);
      toast.success('Item restored to Active');
      fetchItems();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not restore item');
    }
  };

  const handlePermanentDelete = async () => {
    if (!permanentDeleteTarget) return;
    try {
      await permanentlyDeleteMenuItem(permanentDeleteTarget.id);
      toast.success('Item permanently deleted');
      setPermanentDeleteTarget(null);
      fetchItems();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not permanently delete item');
    }
  };

  const handleToggleAvailable = async (item) => {
    try {
      await updateMenuItem(item.id, {
        name: item.name,
        description: item.description,
        price: item.price,
        menuType: 'FIXED',
        available: !item.available,
        allergens: item.allergens,
      });
      toast.success(item.available ? 'Marked out of stock' : 'Marked available');
      fetchItems();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    }
  };

  const openModal = (item = null) => {
    setErrors({});
    setImageFile(null);
    setImageRemoved(false);
    if (item) {
      setEditingId(item.id);
      setFormData({
        name: item.name,
        description: item.description || '',
        price: item.price,
        available: item.available,
        allergens: item.allergens || '',
      });
      setCurrentImageUrl(item.imageUrl || null);
    } else {
      setEditingId(null);
      setFormData(EMPTY_FORM);
      setCurrentImageUrl(null);
    }
    setIsModalOpen(true);
  };

  const activeItems = items.filter((item) => item.active);
  const retiredItems = items.filter((item) => !item.active);

  return (
    <div className="admin-container">
      <div className="page-header flex-between">
        <div>
          <h1>Daily Delights Management</h1>
          <p>Permanent items like drinks, chips and snacks — always available until you change them.</p>
        </div>
        <button className="btn-primary" onClick={() => openModal()}>
          <Plus size={18} /> Add New Item
        </button>
      </div>

      {loading ? (
        <div className="loading-state">Loading items...</div>
      ) : activeItems.length === 0 ? (
        <EmptyState
          icon={UtensilsCrossed}
          title="No Menu Available"
          message="No menu items have been added yet."
          action={
            <button className="btn-primary" onClick={() => openModal()}>
              <Plus size={18} /> Add Menu
            </button>
          }
        />
      ) : (
        <div className="items-grid">
          {activeItems.map((item) => (
            <div className="catalog-card" key={item.id}>
              <div className="card-image">
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt={item.name} />
                ) : (
                  <div className="img-fallback">{item.name.charAt(0)}</div>
                )}
                <span className={`stock-badge ${item.available ? 'available' : 'out'}`}>
                  {item.available ? 'Available' : 'Out of Stock'}
                </span>
              </div>
              <div className="card-content">
                <div className="card-header">
                  <h3>{item.name}</h3>
                </div>
                <p className="desc">{item.description}</p>
                <div className="card-footer">
                  <span className="price">₹{item.price}</span>
                  <div className="actions">
                    <button
                      className="btn-icon"
                      onClick={() => handleToggleAvailable(item)}
                      title={item.available ? 'Mark Out of Stock' : 'Mark Available'}
                    >
                      <Power size={16} />
                    </button>
                    <button className="btn-icon" onClick={() => openModal(item)} title="Edit">
                      <Edit2 size={16} />
                    </button>
                    <button className="btn-icon-danger" onClick={() => setActionTarget(item)} title="Delete">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && retiredItems.length > 0 && (
        <div className="retired-section">
          <button className="retired-header" onClick={() => setShowRetired((prev) => !prev)}>
            {showRetired ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            Retired Items ({retiredItems.length})
          </button>
          {showRetired && (
            <div className="items-grid">
              {retiredItems.map((item) => (
                <div className="catalog-card inactive" key={item.id}>
                  <div className="card-image">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.name} />
                    ) : (
                      <div className="img-fallback">{item.name.charAt(0)}</div>
                    )}
                  </div>
                  <div className="card-content">
                    <div className="card-header">
                      <h3>{item.name}</h3>
                    </div>
                    <p className="desc">{item.description}</p>
                    <div className="card-footer">
                      <span className="price">₹{item.price}</span>
                      <div className="actions">
                        <button className="btn-icon" onClick={() => openModal(item)} title="Edit">
                          <Edit2 size={16} />
                        </button>
                        <button className="btn-icon" onClick={() => handleRestore(item)} title="Restore">
                          <RotateCcw size={16} />
                        </button>
                        <button
                          className="btn-icon-danger"
                          onClick={() => setPermanentDeleteTarget(item)}
                          title="Delete Permanently"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingId ? 'Edit Daily Delights Item' : 'Add New Daily Delights Item'}</h2>
              <button className="close-btn" onClick={() => setIsModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} noValidate>
              <div className="form-group">
                <label>Item Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => {
                    setFormData({ ...formData, name: e.target.value });
                    if (errors.name) setErrors({ ...errors, name: null });
                  }}
                  className={errors.name ? 'input-error' : ''}
                />
                {errors.name && (
                  <span className="field-error-text">
                    <AlertCircle size={14} /> {errors.name}
                  </span>
                )}
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => {
                      setFormData({ ...formData, price: e.target.value });
                      if (errors.price) setErrors({ ...errors, price: null });
                    }}
                    className={errors.price ? 'input-error' : ''}
                  />
                  {errors.price && (
                    <span className="field-error-text">
                      <AlertCircle size={14} /> {errors.price}
                    </span>
                  )}
                </div>

              </div>

              <ImageUploadField
                currentImageUrl={currentImageUrl}
                file={imageFile}
                removed={imageRemoved}
                onFileChange={(file, removed) => {
                  setImageFile(file);
                  setImageRemoved(removed);
                }}
              />

              <div className="form-group">
                <label>Availability</label>
                <button
                  type="button"
                  className={`btn-toggle ${formData.available ? 'active' : ''}`}
                  onClick={() => setFormData({ ...formData, available: !formData.available })}
                >
                  {formData.available ? 'Available' : 'Out of Stock'}
                </button>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingId ? 'Save Changes' : 'Create Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <MenuActionDialog
        open={Boolean(actionTarget)}
        itemName={actionTarget?.name}
        onRetire={handleRetire}
        onPermanentDelete={() => {
          setPermanentDeleteTarget(actionTarget);
          setActionTarget(null);
        }}
        onCancel={() => setActionTarget(null)}
      />

      <ConfirmDialog
        open={Boolean(permanentDeleteTarget)}
        title="Permanently delete this item?"
        message="Are you sure you want to permanently delete this menu item? This action cannot be undone."
        confirmLabel="Delete Permanently"
        onCancel={() => setPermanentDeleteTarget(null)}
        onConfirm={handlePermanentDelete}
      />
    </div>
  );
}
