import React, { ReactElement } from "react";
import { useMutation } from "@apollo/client";
import { Button } from "@material-ui/core";

export default function NewExportButton(): ReactElement {

    return(
        <div style={{ display: "flex", justifyContent: "center"}}> 
        <Button variant="outlined">
            EXPORT
        </Button>
        </div>
    )
}