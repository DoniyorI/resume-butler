"use client";
import React, { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MonthYearPicker } from "@/components/ui/month-year-picker";

export default function CertificationForm() {
  const [certifications, setCertifications] = useState([]);
  const { user, loading, supabase } = useAuth({ redirect: true });

  useEffect(() => {
    if (!user) return;
    const fetchCertifications = async () => {
      const { data, error } = await supabase
        .from("cv_certifications")
        .select("*")
        .eq("user_id", user.id)
        .order("date_earned", { ascending: false });

      if (error) {
        console.error("Error fetching certifications:", error);
        return;
      }

      setCertifications(
        (data || []).map((row) => ({
          id: row.id,
          name: row.name || "",
          issuer: row.issuer || "",
          dateEarned: row.date_earned ? new Date(row.date_earned) : "",
          url: row.url || "",
        }))
      );
    };
    fetchCertifications();
  }, [user, supabase]);

  const addCertification = () => {
    setCertifications([
      ...certifications,
      { name: "", issuer: "", dateEarned: "", url: "", isNew: true },
    ]);
  };

  const updateCertification = (index, field, value) => {
    setCertifications(
      certifications.map((cert, idx) =>
        idx === index ? { ...cert, [field]: value } : cert
      )
    );
  };

  const deleteCertification = async (index) => {
    const entry = certifications[index];
    if (!entry.isNew) {
      const { error } = await supabase
        .from("cv_certifications")
        .delete()
        .eq("id", entry.id);
      if (error) {
        console.error("Error deleting certification:", error);
        return;
      }
    }
    setCertifications(certifications.filter((_, idx) => idx !== index));
  };

  const handleSave = async () => {
    if (!user) return;
    try {
      await Promise.all(
        certifications.map((cert) => {
          const { id, isNew, ...data } = cert;
          const row = {
            user_id: user.id,
            name: data.name,
            issuer: data.issuer,
            date_earned: data.dateEarned
              ? format(new Date(data.dateEarned), "yyyy-MM-dd")
              : null,
            url: data.url || null,
          };
          if (isNew) {
            return supabase.from("cv_certifications").insert(row).select().single();
          } else {
            return supabase.from("cv_certifications").update(row).eq("id", id);
          }
        })
      );
      toast("Certifications saved successfully!");

      // Re-fetch
      const { data } = await supabase
        .from("cv_certifications")
        .select("*")
        .eq("user_id", user.id)
        .order("date_earned", { ascending: false });

      if (data) {
        setCertifications(
          data.map((row) => ({
            id: row.id,
            name: row.name || "",
            issuer: row.issuer || "",
            dateEarned: row.date_earned ? new Date(row.date_earned) : "",
            url: row.url || "",
          }))
        );
      }
    } catch (error) {
      console.error("Error saving certifications:", error);
      toast("Failed to save certifications.");
    }
  };

  if (!user) return <div>Loading...</div>;

  return (
    <>
      <div className="flex space-x-6 justify-between items-center py-4">
        <h1 className="text-2xl text-[#5CA78F] cursor-default">
          Certifications
        </h1>
        <Button
          className="text-[#188665] font-light hover:bg-green-100"
          variant="ghost"
          onClick={addCertification}
        >
          <Plus size={16} className="mr-1" /> Add Certification
        </Button>
      </div>

      {certifications.length === 0 && (
        <p className="text-center text-sm text-gray-400 py-8">
          No certifications added yet. Click &quot;Add Certification&quot; to get
          started.
        </p>
      )}

      {certifications.map((cert, index) => (
        <div className="flex gap-4 pb-8" key={index}>
          <div className="flex items-start pt-8">
            <Trash2
              strokeWidth={1.25}
              size={18}
              className="cursor-pointer hover:text-red-500 text-gray-400"
              onClick={() => deleteCertification(index)}
            />
          </div>
          <div className="flex flex-col space-y-4 flex-grow">
            <div className="flex space-x-6">
              <div className="flex-grow">
                <Label>Certification Name</Label>
                <Input
                  value={cert.name}
                  onChange={(e) => updateCertification(index, "name", e.target.value)}
                  placeholder="e.g. AWS Solutions Architect"
                />
              </div>
              <div className="flex-grow">
                <Label>Issuing Organization</Label>
                <Input
                  value={cert.issuer}
                  onChange={(e) => updateCertification(index, "issuer", e.target.value)}
                  placeholder="e.g. Amazon Web Services"
                />
              </div>
            </div>
            <div className="flex space-x-6">
              <div>
                <Label>Date Earned</Label>
                <MonthYearPicker
                  value={cert.dateEarned}
                  onChange={(date) => updateCertification(index, "dateEarned", date)}
                />
              </div>
              <div className="flex-grow">
                <Label>Credential URL</Label>
                <Input
                  type="url"
                  value={cert.url}
                  onChange={(e) => updateCertification(index, "url", e.target.value)}
                  placeholder="https://..."
                />
              </div>
            </div>
          </div>
        </div>
      ))}

      {certifications.length > 0 && (
        <div className="flex space-x-6 justify-end">
          <Button type="button" onClick={handleSave}>
            Save
          </Button>
        </div>
      )}
    </>
  );
}
