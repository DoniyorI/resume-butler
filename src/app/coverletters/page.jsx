"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { EllipsisVertical } from "lucide-react";
import { FiTrash2 } from "react-icons/fi";
import { MdOutlineEdit } from "react-icons/md";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import CoverLetterDialog from "@/components/CoverLetterDialog";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function Page() {
  const [coverLetters, setCoverLetters] = useState([]);
  const [allCoverLetters, setAllCoverLetters] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState("Recently Opened");
  const { user, loading, supabase } = useAuth({ redirect: true });
  const router = useRouter();
  const [editingId, setEditingId] = useState(null);
  const [editingTitle, setEditingTitle] = useState("");

  useEffect(() => {
    if (loading || !user) return;

    const fetchData = async () => {
      try {
        const { data, error } = await supabase
          .from("cover_letters")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (error) throw error;

        const formatted = (data || []).map((cl) => ({
          id: cl.id,
          title: cl.title,
          dateCreated: new Date(cl.created_at).toLocaleDateString("en-US"),
          lastUpdated: new Date(cl.updated_at).toLocaleDateString("en-US"),
        }));

        setAllCoverLetters(formatted);
        setCoverLetters(formatted);
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    fetchData();
  }, [user, loading, supabase]);

  useEffect(() => {
    const filtered = allCoverLetters
      .filter((cl) =>
        cl.title.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .sort((a, b) => {
        if (sortOrder === "A-Z") return a.title.localeCompare(b.title);
        if (sortOrder === "Z-A") return b.title.localeCompare(a.title);
        if (sortOrder === "Recently Created")
          return new Date(b.dateCreated) - new Date(a.dateCreated);
        if (sortOrder === "Latest Updated")
          return new Date(b.lastUpdated) - new Date(a.lastUpdated);
        return 0;
      });
    setCoverLetters(filtered);
  }, [searchTerm, sortOrder, allCoverLetters]);

  const handleRename = (id, title) => {
    setEditingId(id);
    setEditingTitle(title || "");
  };

  const handleTitleChange = (event) => {
    setEditingTitle(event.target.value);
  };

  const saveTitle = async (id) => {
    if (editingTitle.trim() === "") return;
    try {
      const { error } = await supabase
        .from("cover_letters")
        .update({ title: editingTitle })
        .eq("id", id);
      if (error) throw error;

      setAllCoverLetters((prev) =>
        prev.map((cl) => (cl.id === id ? { ...cl, title: editingTitle } : cl))
      );
      setEditingId(null);
      toast("Title updated successfully");
    } catch (error) {
      console.error("Error updating title:", error);
      toast("Failed to update title");
    }
  };

  const handleDelete = async (id) => {
    if (!id) return;
    try {
      const { error } = await supabase
        .from("cover_letters")
        .delete()
        .eq("id", id);
      if (error) throw error;

      setAllCoverLetters((prev) => prev.filter((cl) => cl.id !== id));
      toast("Cover letter deleted successfully");
    } catch (error) {
      console.error("Error deleting cover letter:", error);
      toast("Failed to delete cover letter");
    }
  };

  return (
    <div className="flex flex-col w-full min-h-screen pt-24 pb-10 px-10">
      <h1 className="text-2xl font-semibold text-[#559F87]">Cover Letters</h1>
      <div className="flex justify-between mx-2 my-1 mt-3">
        <Input
          placeholder="Filter by Cover Letter Name"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          className="max-w-sm"
        />
        <Select defaultValue="Recently Opened" onValueChange={setSortOrder}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Recently Opened" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="Recently Opened">Recently Opened</SelectItem>
              <SelectItem value="A-Z">A-Z</SelectItem>
              <SelectItem value="Z-A">Z-A</SelectItem>
              <SelectItem value="Recently Created">Recently Created</SelectItem>
              <SelectItem value="Latest Updated">Latest Updated</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
      <h2 className="text-lg text-[#559F87] font-semibold mt-4">
        Cover Letters
      </h2>
      <div className="flex flex-wrap ">
        <CoverLetterDialog />
        {coverLetters.map((letter) => (
          <div
            key={letter.id}
            className="h-[220px] w-[170px] border rounded-md shadow justify-between flex flex-col m-2"
          >
            <div
              className="h-full flex justify-center items-center cursor-pointer"
              onClick={() => router.push(`/coverletters/${letter.id}`)}
            >
              Preview
            </div>
            <div className=" flex justify-between py-2 px-2 bg-slate-100">
              <div>
                {editingId === letter.id ? (
                  <input
                    type="text"
                    value={editingTitle}
                    onChange={handleTitleChange}
                    onBlur={() => saveTitle(letter.id)}
                    onKeyPress={(event) => {
                      if (event.key === "Enter") saveTitle(letter.id);
                    }}
                    className="text-sm w-full bg-inherit focus:ring-0"
                    autoFocus
                  />
                ) : (
                  <div className="text-sm">
                    {letter.title.length > 18
                      ? `${letter.title.substring(0, 15)}...`
                      : letter.title}
                  </div>
                )}
                <div className="text-xs text-slate-400">
                  {letter.lastUpdated}
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="p-0 m-0 outline-none select-none "
                  >
                    <EllipsisVertical size={18} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="text-sm">
                  <DropdownMenuItem
                    className="text-xs cursor-pointer"
                    onClick={() => handleRename(letter.id, letter.title)}
                  >
                    <MdOutlineEdit className="mr-2" /> Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-xs cursor-pointer text-red-500"
                    onClick={() => handleDelete(letter.id)}
                  >
                    <FiTrash2 className="mr-2" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
