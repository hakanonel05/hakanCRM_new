import { useState, useEffect } from "react";
import Breadcrumb from "../components/Breadcrumb";
import axios from "axios";
import { 
  Users, 
  Shield, 
  ShieldCheck,
  Trash2,
  Mail,
  Calendar,
  Crown
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
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

const UsersPage = () => {
  const { user: currentUser, isAdmin } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
    }
  }, [isAdmin]);

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
      await axios.patch(`${API}/users/${userId}/role?role=${newRole}`, {}, { withCredentials: true });
      toast.success("Rol güncellendi");
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Rol güncellenemedi");
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
    if (!window.confirm("İzinli listede olmayan TÜM kullanıcılar silinecek. Devam etmek istiyor musunuz?")) {
      return;
    }
    
    try {
      const response = await axios.delete(`${API}/users/cleanup/unauthorized`, { withCredentials: true });
      toast.success(response.data.message);
      if (response.data.deleted_emails?.length > 0) {
        console.log("Silinen e-postalar:", response.data.deleted_emails);
      }
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Temizleme başarısız");
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Shield className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-foreground">Yetkisiz Erişim</h2>
          <p className="text-muted-foreground mt-2">Bu sayfaya erişim yetkiniz bulunmamaktadır.</p>
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
      {/* Header */}
      <div className="page-header">
        <div>
          <Breadcrumb className="mb-1" />
          <h1 className="page-title">Kullanıcı Yönetimi</h1>
          <p className="page-subtitle">{users.length} kullanıcı kayıtlı</p>
        </div>
        <Button 
          onClick={handleCleanupUnauthorized}
          variant="destructive"
          className="bg-red-600 hover:bg-red-700"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Yetkisiz Kullanıcıları Temizle
        </Button>
      </div>

      {/* Users Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kullanıcı</TableHead>
              <TableHead>E-posta</TableHead>
              <TableHead>Giriş Türü</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Kayıt Tarihi</TableHead>
              <TableHead className="text-right">İşlemler</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.user_id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    {user.picture ? (
                      <img src={user.picture} alt={user.name} className="w-10 h-10 rounded-full" />
                    ) : (
                      <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                        <span className="text-emerald-700 font-semibold">
                          {user.name?.charAt(0) || "?"}
                        </span>
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-foreground flex items-center gap-2">
                        {user.name}
                        {user.role === "admin" && (
                          <Crown className="w-4 h-4 text-amber-500" />
                        )}
                      </p>
                      {user.user_id === currentUser?.user_id && (
                        <Badge className="bg-emerald-100 text-emerald-700 text-xs">Siz</Badge>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="w-4 h-4" />
                    {user.email}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className={user.auth_type === "google" ? "bg-blue-100 text-primary" : "bg-muted text-foreground"}>
                    {user.auth_type === "google" ? "Google" : "E-posta"}
                  </Badge>
                </TableCell>
                <TableCell>
                  {user.user_id === currentUser?.user_id ? (
                    <Badge className="bg-amber-100 text-amber-700">
                      <ShieldCheck className="w-3 h-3 mr-1" />
                      Admin
                    </Badge>
                  ) : (
                    <Select
                      value={user.role}
                      onValueChange={(value) => handleRoleChange(user.user_id, value)}
                    >
                      <SelectTrigger className="w-28 h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">Kullanıcı</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Calendar className="w-4 h-4" />
                    {user.created_at ? new Date(user.created_at).toLocaleDateString("tr-TR") : "—"}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  {user.user_id !== currentUser?.user_id && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      onClick={() => handleDeleteUser(user.user_id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default UsersPage;
