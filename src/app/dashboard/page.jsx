import ApplicationTable from '../../components/Table';
export default function dashboard() {
  return(
    <div className=''>
      <h1>Application</h1>
      <p>View your recent job applications here.</p>

      <ApplicationTable />
    </div>
  );
}