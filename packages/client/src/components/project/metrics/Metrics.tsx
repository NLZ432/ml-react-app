import { GetProjectData_project_checkpoints } from "../__generated__/GetProjectData";
import { GetProjectData_project_exports } from "../__generated__/GetProjectData";
import { List, ListItem, ListItemIcon, ListItemText } from "@material-ui/core";
import { GetExportjobs_exportjobs } from "./__generated__/GetExportjobs";
import { CircularProgress } from "@material-ui/core";
import NewExportButton from "./NewExportButton";
import { gql, useQuery } from "@apollo/client";
import React, { ReactElement } from "react";
import NewChart from "./NewChart";

const GET_EXPORTJOBS = gql`
  query GetExportjobs {
    exportjobs {
      name
      checkpointID
      projectID
      exportID
    }
  }
`;

export default function Metrics(props: {
  id: string;
  checkpoints: GetProjectData_project_checkpoints[];
  exports: GetProjectData_project_exports[];
}): ReactElement {
  function onSet(id: string): void {
    console.log("i dont do anything");
  }

  const { data, loading, error } = useQuery(GET_EXPORTJOBS, {
    pollInterval: 2000
  });
  if (loading) return <p>LOADING</p>;
  if (error) return <p>{error.message}</p>;
  if (data === undefined) return <p>NO DATA</p>;

  return (
    <>
      <NewChart id={props.id} choose={onSet} />
      <NewExportButton id={props.id} />
      <Exportjobs jobs={data.exportjobs} id={props.id} />
    </>
  );
}

function Exportjobs(props: { jobs: GetExportjobs_exportjobs[]; id: string }): JSX.Element {
  const projectJobs = props.jobs.filter((job) => job.projectID === props.id);

  return (
    <>
      <List dense={true}>
        {projectJobs.map((job) => (
          <ListItem key={job.checkpointID}>
            <ListItemIcon>
              <CircularProgress />
            </ListItemIcon>
            <ListItemText primary={`exporting checkpoint "${job.name}"`} secondary={job.exportID} />
          </ListItem>
        ))}
      </List>
    </>
  );
}
