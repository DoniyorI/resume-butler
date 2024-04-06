import ApplicationTable from './table';
export default function dashboard() {
  return(
    <div>
      <h1>Application</h1>
      <p>View your recent job applications here.</p>

      <ApplicationTable />
    </div>
  );
}