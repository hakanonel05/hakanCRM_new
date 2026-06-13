import { useState, useEffect } from "react";
import Breadcrumb from "../components/Breadcrumb";
import axios from "axios";
import {
  Shield,
  ShieldCheck,
  Trash2,
  Mail,
  Calendar,
  Crown,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Switch } from "../components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { toast } from "sonner";
import { useAuth } from "../App";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PERMISSION_DEFS = [
  { key: "can_delete", label: "Silme" },
  { key: "can_edit_dashboard", label: "Dashboard Düzenleme" },
];

const UsersPage = () => {
  const { user: currentUser, isSuperAdmin } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingPerm, setSavingPerm] = useState({}); // {`${userId}:${key}`: true}

  useEffect(() => {
    if (isSuperAdmin) fetchUsers();
  }, [isSuperAdmin]);

  const fetchUsers = async () => {
    try {
      const response = await axios.get(`${API}/users`, { withCredentials: true });
      setUsers(response.data);
    } catch (error) {
      console.error("Kullanıcılar yüklenirken hata:", error);
      toast.error("Kullanıcılar yüklenemedi");
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      await axios.patch(
        `${API}/users/${userId}/role?role=${newRole}`,
        {},
        { withCredentials: true }
      );
      toast.success("Rol güncellendi");
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Rol güncellenemedi");
    }
  };

  const handlePermissionToggle = async (userId, key, value) => {
    const lockKey = `${userId}:${key}`;
    setSavingPerm((s) => ({ ...s, [lockKey]: true }));
    // Optimistic update
    setUsers((prev) =>
      prev.map((u) =>
        u.user_id === userId
          ? { ...u, permissions: { ...(u.permissions || {}), [key]: value } }
          : u
      )
    );
    try {
      await axios.patch(
        `${API}/users/${userId}/permissions`,
        { [key]: value },
        { withCredentials: true }
      );
      toast.success(value ? "Yetki açıldı" : "Yetki kapatıldı");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Yetki güncellenemedi");
      fetchUsers(); // revert on error
    } finally {
      setSavingPerm((s) => {
        const n = { ...s };
        delete n[lockKey];
        return n;
      });
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm("Bu kullanıcıyı silmek istediğinizden emin misiniz?")) return;
    try {
      await axios.delete(`${API}/users/${userId}`, { withCredentials: true });
      toast.success("Kullanıcı silindi");
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Kullanıcı silinemedi");
    }
  };

  const handleCleanupUnauthorized = async () => {
    if (
      !window.confirm(
        "İzinli listede olmayan TÜM kullanıcılar silinecek. Devam etmek istiyor musunuz?"
      )
    ) {
      return;
    }
    try {
      const response = await axios.delete(
        `${API}/users/cleanup/unauthorized`,
        { withCredentials: true }
      );
      toast.success(response.data.message);
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Temizleme başarısız");
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[400px]" data-testid="users-page-unauthorized">
        <div className="text-center">
          <Shield className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-foreground">Yetkisiz Erişim</h2>
          <p className="text-muted-foreground mt-2">
            Bu sayfa yalnızca süper admin tarafından görüntülenebilir.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="loading-spinner">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div data-testid="users-page">
      <div className="page-header">
        <div>
          <Breadcrumb className="mb-1" />
          <h1 className="page-title">Kullanıcı Yönetimi</h1>
          <p className="page-subtitle">
            {users.length} kullanıcı kayıtlı — adminler tüm yetkilere sahiptir
          </p>
        </div>
        <Button
          onClick={handleCleanupUnauthorized}
          variant="destructive"
          className="bg-red-600 hover:bg-red-700"
          data-testid="cleanup-unauthorized-btn"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Yetkisiz Kullanıcıları Temizle
        </Button>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kullanıcı</TableHead>
              <TableHead>E-posta</TableHead>
              <TableHead>Rol</TableHead>
              {PERMISSION_DEFS.map((p) => (
                <TableHead key={p.key} className="text-center">
                  {p.label}
                </TableHead>
              ))}
              <TableHead>Kayıt</TableHead>
              <TableHead className="text-right">İşlemler</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => {
              const isUserAdmin = u.is_admin || u.role === "admin";
              const isSelf = u.user_id === currentUser?.user_id;
              return (
                <TableRow key={u.user_id} data-testid={`user-row-${u.email}`}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {u.picture ? (
                        <img src={u.picture} alt={u.name} className="w-10 h-10 rounded-full" />
                      ) : (
                        <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                          <span className="text-emerald-700 font-semibold">
                            {u.name?.charAt(0) || "?"}
                          </span>
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-foreground flex items-center gap-2">
                          {u.name}
                          {isUserAdmin && <Crown className="w-4 h-4 text-amber-500" />}
                        </p>
                        {isSelf && (
                          <Badge className="bg-emerald-100 text-emerald-700 text-xs">
                            Siz
                          </Badge>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="w-4 h-4" />
                      {u.email}
                    </div>
                  </TableCell>
                  <TableCell>
                    {isSelf || u.email?.toLowerCase() === "hakanonel05@gmail.com" ? (
                      <Badge className="bg-amber-100 text-amber-700">
                        <ShieldCheck className="w-3 h-3 mr-1" />
                        Admin
                      </Badge>
                    ) : (
                      <Select
                        value={u.role}
                        onValueChange={(value) => handleRoleChange(u.user_id, value)}
                      >
                        <SelectTrigger className="w-28 h-8" data-testid={`role-select-${u.email}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">Kullanıcı</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </TableCell>
                  {PERMISSION_DEFS.map((p) => {
                    const lockKey = `${u.user_id}:${p.key}`;
                    const checked = isUserAdmin
                      ? true
                      : !!u.permissions?.[p.key];
                    return (
                      <TableCell key={p.key} className="text-center">
                        <div className="flex items-center justify-center">
                          <Switch
                            checked={checked}
                            disabled={isUserAdmin || !!savingPerm[lockKey]}
                            onCheckedChange={(v) =>
                              handlePermissionToggle(u.user_id, p.key, v)
                            }
                            data-testid={`perm-switch-${p.key}-${u.email}`}
                          />
                        </div>
                      </TableCell>
                    );
                  })}
                  <TableCell>
                    <div className="flex items-center gap-2 text-muted-foreground text-sm">
                      <Calendar className="w-4 h-4" />
                      {u.created_at
                        ? new Date(u.created_at).toLocaleDateString("tr-TR")
                        : "—"}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {!isSelf && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={() => handleDeleteUser(u.user_id)}
                        data-testid={`delete-user-${u.email}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default UsersPage;
