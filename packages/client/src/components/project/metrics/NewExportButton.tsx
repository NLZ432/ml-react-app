import { Button, Dialog, DialogActions, DialogContent, TextField } from "@material-ui/core";
import { useMutation } from "@apollo/client";
import React, { ReactElement } from "react";
import NewChart from "./NewChart";
import gql from "graphql-tag";

const EXPORT_CHECKPOINT_BUTTON_MUTATION = gql`
  mutation exportCheckpointButton($id: ID!, $checkpointID: String!, $name: String!) {
    exportCheckpoint(id: $id, checkpointID: $checkpointID, name: $name) {
      id
    }
  }
`;

export default function NewExportButton(props: { id: string }): ReactElement {
  const [exportCheckpoint] = useMutation(EXPORT_CHECKPOINT_BUTTON_MUTATION);
  const [name, setName] = React.useState<string>("EXPORT");
  const [open, setOpen] = React.useState(false);

  const handleClick = () => {
    setOpen(true);
  };
  const handleClose = () => {
    setOpen(false);
  };
  const handleExport = (checkpointID: string) => {
    const id = props.id;

    exportCheckpoint({ variables: { id, checkpointID, name } }).catch((err) => {
      console.log(err);
    });
    handleClose();
  };

  return (
    <>
      <div style={{ display: "flex", justifyContent: "center" }}>
        <Button variant="outlined" onClick={handleClick}>
          EXPORT
        </Button>
      </div>
      <Dialog onClose={handleClose} open={open} style={{ display: "block" }} maxWidth="xl">
        <DialogContent dividers>
          <NewChart id={props.id} choose={handleExport} />
        </DialogContent>
        <DialogActions>
          <TextField
            onChange={(event) => setName(event.target.value)}
            value={name}
            autoFocus
            margin="dense"
            label="Video Name"
            fullWidth
          />
          <Button autoFocus onClick={handleClose}>
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
